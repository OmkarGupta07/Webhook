import { Injectable } from '@nestjs/common';
import {WebhookEvent,WebhookStatus} from './webhook-event.schema.js' 
import { Repository } from 'typeorm';   
import { InjectRepository } from '@nestjs/typeorm'; 
import { WebhookDto } from './webhook.dto.js';

@Injectable()
export class WebhookService {

 constructor(@InjectRepository(WebhookEvent) private readonly webhookRepository:Repository<WebhookEvent>){}


 async receive(dto:WebhookDto){
    const event = this.webhookRepository.create({
        eventId:dto.eventId,
        type:dto.type,
        payload:dto,
        status:WebhookStatus.PENDING,
        attemptCount:0,
        nextAttemptAt:new Date(),
    })

    try{
        await this.webhookRepository.insert(event);
    }
    catch(error:any){
        if(error.code=='23505'){
            return{accepted:true,duplicate:true};
        }
        throw error;
    }
    return{accepted:true,duplicate:false};
 }


 async retry(eventId: string) {
  const event =
    await this.webhookRepository.findOne({
      where: { eventId },
    });

  if (!event) {
    throw new Error(
      `Event ${eventId} not found`,
    );
  }

  if (
    event.status !== WebhookStatus.FAILED
  ) {
    return {
      retried: false,
      message:
        'Only permanently failed events can be manually retried',
    };
  }

  event.status = WebhookStatus.PENDING;
  event.nextAttemptAt = new Date();
  event.lockedAt = null;
  event.lockedBy = null;

  await this.webhookRepository.save(event);

  return {
    retried: true,
    eventId,
  };
}

}
