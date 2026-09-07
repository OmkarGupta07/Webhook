import { Body, Controller, Post ,Param } from '@nestjs/common';
import { WebhookService } from './webhook.service.js';
import { WebhookDto } from './webhook.dto.js';
@Controller('webhook')
export class WebhookController {

    constructor(private readonly webhookServie:WebhookService){}

    @Post()
    async receive(@Body() dto:WebhookDto){
        return this.webhookServie.receive(dto);
    }



    @Post(':eventId/retry')
    async retry(
        @Param('eventId') eventId: string,
    ) {
        return this.webhookServie.retry(eventId);
    }
}
