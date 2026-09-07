import { NestFactory } from '@nestjs/core';
import { WorkerAppModule } from './worker/worker-app.module.js';

async function bootstrap() {
  await NestFactory.createApplicationContext(
    WorkerAppModule,
  );

  console.log(
    `Worker process started: ${process.pid}`,
  );
}

bootstrap();