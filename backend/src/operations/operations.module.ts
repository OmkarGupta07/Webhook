import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OperationsController } from './operations.controller.js';
import { OperationsService } from './operations.service.js';

import { WebhookEvent } from '../webhook/webhook-event.schema.js';
import { ProcessingAttempt } from '../worker/processing-attempt.schema.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebhookEvent,
      ProcessingAttempt,
    ]),
  ],
  controllers: [
    OperationsController,
  ],
  providers: [
    OperationsService,
  ],
})
export class OperationsModule {}