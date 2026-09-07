import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WebhookEvent } from './webhook/webhook-event.schema.js';
import { ProcessingAttempt } from './worker/processing-attempt.schema.js';
import { ProcessedOrder } from './processed-orders/processed-order.schema.js';
import { WebhookModule } from './webhook/webhook.module.js';
import { OperationsModule } from './operations/operations.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],

      inject: [ConfigService],

      useFactory: (config: ConfigService) => ({
        type: 'postgres',

        host: config.get<string>('DATABASE_HOST'),
        port: config.get<number>('DATABASE_PORT'),
        username: config.get<string>('DATABASE_USER'),
        password: config.get<string>('DATABASE_PASSWORD'),
        database: config.get<string>('DATABASE_NAME'),

        entities: [
          WebhookEvent,
          ProcessingAttempt,
          ProcessedOrder,
        ],

        synchronize: true,
      }),
    }),

    WebhookModule,
    OperationsModule,
  ],
})
export class AppModule {}