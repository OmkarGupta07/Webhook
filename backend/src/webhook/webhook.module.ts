import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller.js';
import { WebhookService } from './webhook.service.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEvent } from './webhook-event.schema.js';

@Module({
  imports:[TypeOrmModule.forFeature([WebhookEvent])],
  controllers: [WebhookController],
  providers: [WebhookService]
})

export class WebhookModule {}

