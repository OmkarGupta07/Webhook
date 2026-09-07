import {
  IsNotEmpty,
  IsObject,
  IsString,
} from 'class-validator';

export class WebhookDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsObject()
  data: Record<string, any>;
}