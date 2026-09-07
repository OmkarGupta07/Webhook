import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';
import { OperationsService } from './operations.service.js';


@Controller('operations')
export class OperationsController {
  constructor(
    private readonly operationsService:
      OperationsService,
  ) {}

  @Get('events')
  getEvents() {
    return this.operationsService.getEvents();
  }

  @Get('events/:eventId')
  getEvent(
    @Param('eventId') eventId: string,
  ) {
    return this.operationsService.getEvent(
      eventId,
    );
  }
}