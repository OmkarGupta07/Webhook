import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    WebhookEvent,
    WebhookStatus,
} from '../webhook/webhook-event.schema.js';
import { ProcessingAttempt,AttemptResult } from './processing-attempt.schema.js';
import { ProcessedOrder } from '../processed-orders/processed-order.schema.js';
import { ConfigService } from '@nestjs/config';
import { throwError } from 'rxjs';
@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {

    private readonly logger = new Logger(WorkerService.name);
    private running = true;
    private readonly workerId = `worker-${process.pid}`;

    constructor(@InjectRepository(WebhookEvent) private readonly webhookRepository: Repository<WebhookEvent>,
                @InjectRepository(ProcessingAttempt) private readonly attemptRepository: Repository<ProcessingAttempt>,
                @InjectRepository(ProcessedOrder) private readonly processedOrderRepository: Repository<ProcessedOrder>, 
                private readonly configService: ConfigService

            ) { }

    onModuleInit() {
        this.logger.log('Worker Started:');
        this.startWorkerLoop();
    }

    onModuleDestroy() {
        this.running = false;
    }

    private async startWorkerLoop() {
        while (this.running) {
            try {
                const event = await this.claimNextEvent();

                if (!event) {
                    await this.sleep(1000);
                    continue;
                }

                await this.processEvent(event);

            } catch (error) {
                this.logger.error(error);
                await this.sleep(1000);
            }
        }
    }

    private async claimNextEvent(): Promise<WebhookEvent | null> {
        return this.webhookRepository.manager.transaction(
            async (manager) => {
                const events = await manager
                    .createQueryBuilder(WebhookEvent, 'event')
                    .setLock('pessimistic_write')
                    .setOnLocked('skip_locked')
                    .where('event.status = :status', { status: WebhookStatus.PENDING })
                    .andWhere('event.nextAttemptAt <= NOW()')
                    .orderBy('event.createdAt', 'ASC')
                    .limit(1)
                    .getMany();

                if (events.length === 0) {
                    return null;
                }

                const event = events[0];
                event.status = WebhookStatus.PROCESSING;
                const attemptNumber = event.attemptCount + 1;
                 event.attemptCount = attemptNumber;
                event.lockedAt = new Date();
                event.lockedBy = this.workerId;
                await manager.save(event);

                const attempt=manager.create(ProcessingAttempt,{eventId:event.eventId,attemptNumber,workerId:this.workerId,startedAt:new Date(),finishedAt:null,result:AttemptResult.FAILED,error:null})
                
                await manager.save(attempt);
                return event ;
           
            }
        )
    }


    private async recoverStaleEvent(){
        const leaseTimeoutSecond=this.configService.get('LEASE_TIMEOUT_SECONDS',30);

        const staleBefore=new Date(Date.now()-leaseTimeoutSecond*1000);

        await this.webhookRepository.manager.transaction(async (manager)=>{
            const staleEvents=await manager.createQueryBuilder(WebhookEvent,'event').setLock('pessimistic_write').where('event.status=:Status',{status:WebhookStatus.PROCESSING},).andWhere('event.locked_at<:staleBefore',{staleBefore}).getMany();

            for(const event of staleEvents){
                this.logger.warn(`Recovering Stale Event ${event.eventId} previouslt owned by ${event.lockedBy}`);

                const attempt = await manager.findOne(ProcessingAttempt,{where:{eventId:event.eventId,attemptNumber:event.attemptCount}});

                if(attempt && !attempt.finishedAt){
                    attempt.result=AttemptResult.FAILED;
                    attempt .error='Worker lease expired';
                    attempt.finishedAt=new Date();
                    await manager.save(attempt);
                }
                event.status=WebhookStatus.PENDING;
                event.lockedAt=null;
                event.lockedBy=null;
                event.nextAttemptAt=new Date();
                await manager.save(event);


            }

        })

    }

    private async processEvent(event: WebhookEvent) {
        this.logger.log(`${this.workerId} processing ${event.eventId}`);
        const leaseRenewal=this.startLeaseRenewal(event);

        try {
            await this.simulateProcessing(event);
            await this.markSuccess(event);
        }
        catch (error: any) {
            const errorMessage = error?.message ?? 'Unknown processing error';
            await this.markAttemptFailed(
                event,
                errorMessage,
            );

            await this.handleFailure(
                event,
                errorMessage,
            );
        } finally {
            clearInterval(leaseRenewal);
        }
    }


    private startLeaseRenewal(event: WebhookEvent) {
        const leaseTimeoutSecond = this.configService.get<number>(
            'LEASE_TIMEOUT_SECONDS',
            30,
        );

        const intervalMs = Math.max(1000, (leaseTimeoutSecond * 1000) / 3);


        return setInterval(async () => {
            if (!this.running) {
                return;
            }
            try {
                const result = await this.webhookRepository.createQueryBuilder()
                    .update(WebhookEvent)
                    .set({ lockedAt: new Date() })
                    .where('event_id=:eventId',
                        { eventId: event.eventId })
                    .andWhere('status =:status', {
                        status: WebhookStatus.PROCESSING,
                    }).andWhere('locked_by =:workerId', {
                        workerId: this.workerId,
                    }).execute();

                if (result.affected !== 1) {
                    this.logger.warn(
                        `Worker ${this.workerId} lost lease for ${event.eventId}`,
                    );
                }
            }
            catch (error: any) {
                this.logger.error(`Lease renewal failed for ${event.eventId}:${error.message}`);
            }
        }, intervalMs);
    }


    private async markSuccess(event: WebhookEvent) {
        await this.webhookRepository.manager.transaction(
            async (manager) => {
                const currentEvent = await manager.findOne(WebhookEvent, { where: { eventId: event.eventId } });

                if (!currentEvent || currentEvent.status !== WebhookStatus.PROCESSING || currentEvent.lockedBy !== this.workerId) {
                    throw new Error(
                        `Worker ${this.workerId} no longer owns event ${event.eventId}`,
                    );
                }
                const orderId=event.payload.data?.orderId;
            
                if(!orderId){
                    throw new Error(
                        `OrderId is missing from webhook data`,
                    );
                }

                try{
                    await manager.createQueryBuilder()
                                 .insert()
                                 .into(ProcessedOrder)
                                 .values({
                                    orderId,
                                    eventId:event.eventId,})
                                 .orIgnore()
                                 .execute();
                }
                catch(error:any){
                    throw error;
                }

                currentEvent.status =
                    WebhookStatus.PROCESSED;

                currentEvent.lockedAt = null;

                currentEvent.lockedBy = null;

                await manager.save(
                    currentEvent,
                );

                const attempt=await manager.findOne(ProcessingAttempt,{where:{eventId:event.eventId,attemptNumber:event.attemptCount}})

                if(attempt){
                    attempt.result=AttemptResult.SUCCESS;
                    attempt.finishedAt=new Date();
                    attempt.error=null;
                    await manager.save(attempt);
                }
            }
        )

         this.logger.log(
      `${event.eventId} processed successfully on attempt ${event.attemptCount}`,
    );
    }

    private async markAttemptFailed(event:WebhookEvent,errorMessage:string){
        const attempt=await this.attemptRepository.findOne({
            where:{
                eventId:event.eventId,
                attemptNumber:event.attemptCount
            }
        })

        if(!attempt){
            return;
        }

        attempt.result=AttemptResult.FAILED;
        attempt.error=errorMessage;
        attempt.finishedAt=new Date();

        await this.attemptRepository.save(attempt);
    }

    private async handleFailure(event: WebhookEvent, errorMessage: string) {
        const maxAttempts =
            this.configService.get<number>(
                'MAX_ATTEMPTS',
                5,
            );

        if (event.attemptCount >= maxAttempts) {
            await this.webhookRepository.createQueryBuilder()
                .update(WebhookEvent)
                .set({
                    status: WebhookStatus.FAILED,
                    lockedAt: null,
                    lockedBy: null,
                })
                .where(
                    'event_id=:evetId', {
                    eventId: event.eventId,
                },
                )
                .andWhere(
                    'status = :status',
                    {
                        status:
                            WebhookStatus.PROCESSING,
                    },
                )
                .andWhere(
                    'locked_by = :workerId',
                    {
                        workerId:
                            this.workerId,
                    },
                )
                .execute();

            this.logger.error(
                `${event.eventId} permanently failed after ${event.attemptCount} attempts`,
            );

            return;
        }

        const baseDelay =
            this.configService.get<number>(
                'BASE_RETRY_DELAY_SECONDS',
                5,
            );

        const delaySeconds = baseDelay * Math.pow(2, event.attemptCount - 1);
        const nextAttemptAt = new Date(Date.now() + delaySeconds * 1000);

        await this.webhookRepository.createQueryBuilder()
            .update(WebhookEvent)
            .set({
                status: WebhookStatus.PENDING,
                nextAttemptAt,
                lockedAt: null,
                lockedBy: null
            })
            .where(
                'event_id = :eventId', {
                eventId: event.eventId,
            }
            )
            .andWhere(
                'status =:status',
                { status: WebhookStatus.PROCESSING }
            )
            .andWhere(
                'locked_by =: workerId', {
                workerId: this.workerId
            }
            )
            .execute();
        this.logger.warn(
            `${event.eventId} failed: ${errorMessage}. Retrying in ${delaySeconds}s`,
        );


    }


    private async simulateProcessing(event: WebhookEvent) {
        const simulate = event.payload.data?.simulate ?? 'ok';

        if (simulate === 'ok') {
            return;
        }

        if (simulate === 'always_fail') {
            throw new Error('Simulatede Permanent Failure');
        }

        if (simulate.startsWith('fail_then_succed:')) {
            const value = simulate.split(':')[1];
            const failCount = Number(value);

            if (Number.isNaN(failCount) || failCount < 0) {
                throw new Error('Invalid fail -> succed value')
            }

            if (event.attemptCount <= failCount) {
                throw new Error(`Simulated temporary failure on attempt ${event.attemptCount}`);
            }

            return;
        }

        if (simulate.startsWith('slow')) {
            const value = simulate.split(':')[1];
            const seconds = Number(value);

            if (Number.isNaN(seconds) || seconds < 0) {
                throw new Error(
                    'Invalid slow duration',
                );
            }
            await this.sleep(seconds * 1000);
            return;
        }

        throw new Error(
            `Unknown simulation mode: ${simulate}`,
        );
    }



    private sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms),);
    }

}
