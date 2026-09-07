import {Column,CreateDateColumn,Entity,Index,PrimaryGeneratedColumn,UpdateDateColumn} from "typeorm"

export enum WebhookStatus{
    PENDING='PENDING',
    PROCESSING='PROCESSING',
    PROCESSED='PROCESSED',
    FAILED='FAILED'
}

@Entity('webhook_events')
export class WebhookEvent{
    @PrimaryGeneratedColumn('uuid')
    id:string;

    @Index({unique:true})
    @Column({name:'event_id',type:'varchar'})
    eventId:string;

    @Column({type:'varchar'})
    type:string;

    @Column({type:'jsonb'})
    payload:Record<string,any>;

    @Column({
        type:'enum',
        enum:WebhookStatus,
        default:WebhookStatus.PENDING,
    })
    status:WebhookStatus;

    @Column({
        name: 'attempt_count',
        type: 'integer',
        default: 0,
    })
    attemptCount: number;

    @Column({
        name: 'next_attempt_at',
        type:'timestamptz',
        default:()=>'NOW()',
    })
    nextAttemptAt:Date;

    @Column({
        name: 'locked_at',
        type: 'timestamptz',
        nullable: true,
    })
    lockedAt: Date | null;

    @Column({
        name:'locked_by',
        type:'varchar',
        nullable:true
    })
    lockedBy: string | null;

    @CreateDateColumn({name:'created_at'})
    createdAt:Date;

    @UpdateDateColumn({name:'updated_at'})
    updatedAt:Date;
}