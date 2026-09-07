import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service.js';
import { WebhookEvent } from '../webhook/webhook-event.schema.js';  
import { ProcessingAttempt } from './processing-attempt.schema.js';
import { ProcessedOrder } from '../processed-orders/processed-order.schema.js';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebhookEvent,
      ProcessingAttempt,
      ProcessedOrder,
    ]),
  ],
  providers: [WorkerService]
})
export class WorkerModule {}
