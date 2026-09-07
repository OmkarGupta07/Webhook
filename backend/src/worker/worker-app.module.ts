import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WebhookEvent } from '../webhook/webhook-event.schema.js';
import { ProcessingAttempt } from './processing-attempt.schema.js';
import { ProcessedOrder } from '../processed-orders/processed-order.schema.js';

import { WorkerService } from './worker.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST,
      port: Number(
        process.env.DATABASE_PORT,
      ),
      username: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      entities: [
        WebhookEvent,
        ProcessingAttempt,
        ProcessedOrder,
      ],
      synchronize: true,
    }),

    TypeOrmModule.forFeature([
      WebhookEvent,
      ProcessingAttempt,
      ProcessedOrder,
    ]),
  ],

  providers: [
    WorkerService,
  ],
})
export class WorkerAppModule {}