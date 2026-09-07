import {Column,CreateDateColumn,Entity,PrimaryGeneratedColumn} from "typeorm"

export enum AttemptResult{
    SUCCESS='SUCCESS',
    FAILED='FAILED',
}

@Entity('processing_attempts')
export class ProcessingAttempt{
    @PrimaryGeneratedColumn('uuid')
    id:string;

    @Column({name:'event_id',type:'varchar'})
    eventId:string;

    @Column({ name: 'attempt_number', type: 'integer' })
    attemptNumber: number;

    @Column({name:'worker_id',type:'varchar'})
    workerId:string;

    @Column({name:'started_at',type:'timestamptz'})
    startedAt:Date;

    @Column({
        name:'finished_at',
        type:'timestamptz',
        nullable:true,
    })
    finishedAt:Date | null ;

    @Column({type:'enum',enum:AttemptResult})
    result:AttemptResult;

    @Column({type:'text',nullable:true})
    error: string | null ;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

}