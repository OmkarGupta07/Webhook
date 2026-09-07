import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WebhookEvent } from '../webhook/webhook-event.schema.js';
import { ProcessingAttempt } from '../worker/processing-attempt.schema.js';

@Injectable()
export class OperationsService {
  constructor(
    @InjectRepository(WebhookEvent)
    private readonly eventRepository:
      Repository<WebhookEvent>,

    @InjectRepository(ProcessingAttempt)
    private readonly attemptRepository:
      Repository<ProcessingAttempt>,
  ) {}

  async getEvents() {
    return this.eventRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getEvent(eventId: string) {
    const event =
      await this.eventRepository.findOne({
        where: { eventId },
      });

    if (!event) {
      return null;
    }

    const attempts =
      await this.attemptRepository.find({
        where: { eventId },
        order: {
          attemptNumber: 'ASC',
        },
      });

    return {
      event,
      attempts,
    };
  }
}