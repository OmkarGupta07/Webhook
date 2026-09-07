import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';


@Entity('processed_orders')
@Index(['eventId'],{unique:true})
export class ProcessedOrder{
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'eventId', type: 'varchar' })
  eventId:string;

  @Column({ name: 'order_id', type: 'varchar' })
  orderId:string;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt: Date;
}