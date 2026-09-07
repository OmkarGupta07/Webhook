# Reliable Webhook Processor

A reliable webhook processing system built with NestJS, PostgreSQL, Next.js, and Docker.

The system accepts webhook events through an HTTP API, persists them before acknowledging the request, and processes them asynchronously using multiple worker processes.

The implementation focuses on:

* Idempotent webhook ingestion
* Duplicate-safe business processing
* Concurrent background workers
* Retry with exponential backoff
* Worker crash recovery using leases
* Processing attempt history
* Manual retry of permanently failed events
* Operations dashboard
* Docker-based local setup

---

## Architecture

text
                         ┌─────────────────────┐
                         │      Next.js        │
                         │ Operations Dashboard│
                         └──────────┬──────────┘
                                    │
                                    │ HTTP
                                    ▼
┌───────────────┐           ┌──────────────────┐
│ Webhook       │           │   NestJS API     │
│ Provider      │──────────▶│ POST /webhooks   │
└───────────────┘           └────────┬─────────┘
                                     │
                                     │ Persist
                                     ▼
                            ┌──────────────────┐
                            │   PostgreSQL     │
                            │                  │
                            │ webhook_events   │
                            │ processed_orders │
                            │ processing_      │
                            │ attempts         │
                            └────────┬─────────┘
                                     │
                         ┌───────────┴───────────┐
                         │                       │
                         ▼                       ▼
                  ┌─────────────┐         ┌─────────────┐
                  │  Worker 1   │         │  Worker 2   │
                  │             │         │             │
                  │ Claim event │         │ Claim event │
                  │ Process     │         │ Process     │
                  │ Retry       │         │ Retry       │
                  └─────────────┘         └─────────────┘


PostgreSQL is used as both the persistent store and work queue.

Workers claim pending events using PostgreSQL row-level locking with `FOR UPDATE SKIP LOCKED`.

---

## Tech Stack

### Backend

* NestJS
* TypeScript
* TypeORM
* PostgreSQL
* class-validator

### Frontend

* Next.js
* React
* TypeScript

### Infrastructure

* Docker
* Docker Compose


## Project Structure

reliable-webhook-processor/
│
├── backend/
│   ├── src/
│   │   ├── webhook/
│   │   ├── worker/
│   │   ├── processed-orders/
│   │   ├── operations/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   └── worker.ts
│   │
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   └── app/
│   │
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
└── README.md


---

# Getting Started

## Prerequisites

Install:

* Docker Desktop
* Git

No local PostgreSQL installation is required.

---

## Run the application

Clone the repository and enter the project directory:

bash
git clone <repository-url>
cd reliable-webhook-processor


Start the complete application:

bash
docker compose up -d --build


Check the containers:

bash
docker compose ps


The following containers should be running:

text
webhook-postgres
webhook-api
webhook-worker-1
webhook-worker-2
webhook-frontend


---

## Application URLs

Backend API:

http://localhost:3000


Operations dashboard:

http://localhost:3001


---

# API

## Receive Webhook

http
POST /webhooks


Example:

json
{
  "eventId": "evt_123",
  "type": "order.created",
  "data": {
    "orderId": "ORD-1001",
    "customerId": "CUS-42",
    "simulate": "ok"
  }
}


The event is persisted before the API acknowledges the request.

Example response:

json
{
  "accepted": true,
  "duplicate": false
}


If the same `eventId` has already been received:

json
{
  "accepted": true,
  "duplicate": true
}


---

## Manual Retry

http
POST /webhooks/:eventId/retry


Manual retry is allowed only for events that have permanently failed.

Example:

bash
curl -X POST http://localhost:3000/webhooks/evt_123/retry


---

## Operations API

Get all events:

http
GET /operations/events


Get event details and processing history:

http
GET /operations/events/:eventId


---

# Data Model

The system uses three primary tables.

## `webhook_events`

Stores the original webhook and its current processing state.

Important fields include:

text
event_id
type
payload
status
attempt_count
next_attempt_at
locked_at
locked_by
created_at
updated_at


`event_id` has a unique constraint to prevent duplicate webhook ingestion.

Possible states:

text
PENDING
PROCESSING
PROCESSED
FAILED


---

## `processed_orders`

This table is the source of truth for successful business processing.

text
id
order_id
event_id
processed_at


`event_id` has a unique constraint.

This ensures that even if the same webhook is delivered multiple times, only one successful business record can be created.

---

## `processing_attempts`

Stores processing history.

text
id
event_id
attempt_number
worker_id
started_at
finished_at
result
error
created_at


This allows operators to see exactly which worker processed an event, how many attempts occurred, and why an attempt failed.

---

# Concurrency Control

Multiple worker processes run concurrently.

Workers claim events using:

sql
SELECT ...
FROM webhook_events
WHERE status = 'PENDING'
  AND next_attempt_at <= NOW()
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;


The selected event is changed to:

text
PROCESSING


and assigned:

text
locked_by = worker-id
locked_at = current-time


`FOR UPDATE SKIP LOCKED` prevents two workers from claiming the same pending row simultaneously.

---

# Idempotency

There are two levels of duplicate protection.

### 1. Webhook ingestion

`webhook_events.event_id` has a unique constraint.

Therefore:

text
event A
event A
event A


does not create three webhook records.

### 2. Business processing

`processed_orders.event_id` also has a unique constraint.

Therefore the successful business operation can only create one:

text
processed_orders


record for a given event.

The database constraint is the final source of truth rather than relying only on application-level checks.

---

# Retry Strategy

Temporary processing failures are retried using exponential backoff.

With:

text
BASE_RETRY_DELAY_SECONDS=5


the delays are:

text
Attempt 1 → failure → 5 seconds
Attempt 2 → failure → 10 seconds
Attempt 3 → failure → 20 seconds
Attempt 4 → failure → 40 seconds


The maximum number of attempts is configurable:

text
MAX_ATTEMPTS=5


After the maximum number of attempts, the event becomes:

text
FAILED


---

# Worker Crash Recovery

Workers use a lease mechanism.

When a worker claims an event:

text
locked_by = worker-123
locked_at = current time


The worker periodically renews the lease while processing.

This allows long-running events to remain owned by the active worker.

If the worker crashes, lease renewal stops.

Once:

text
current time > locked_at + lease timeout


another worker can recover the event by moving it back to:

text
PENDING


The expired processing attempt is recorded as failed with:

text
Worker lease expired


A new worker can then claim and process the event.

This prevents events from remaining permanently stuck in `PROCESSING`.

---

# Simulation Modes

The webhook payload supports several simulation modes.

## Successful processing

json
"simulate": "ok"


Processes successfully.

## Temporary failure

json
"simulate": "fail_then_succeed:2"


Fails twice and succeeds on the third attempt.

Expected:

text
Attempt 1 → FAILED
Attempt 2 → FAILED
Attempt 3 → SUCCESS


## Permanent failure

json
"simulate": "always_fail"


Always fails until `MAX_ATTEMPTS` is reached.

## Slow processing

json
"simulate": "slow:60"


Simulates a 60-second processing operation.

This is useful for testing worker concurrency, lease renewal, and crash recovery.

---

# Testing Scenarios

The implementation is designed to demonstrate the following scenarios.

### 1. Normal successful event

text
POST /webhooks
        ↓
PENDING
        ↓
PROCESSING
        ↓
PROCESSED


### 2. Simultaneous duplicate

Two requests with the same `eventId` are sent concurrently.

Expected:

text
webhook_events       → 1 record
processed_orders     → 1 record


### 3. Temporary failure

text
FAIL → retry → FAIL → retry → SUCCESS


### 4. Permanent failure

text
FAIL → FAIL → FAIL → FAIL → FAIL
                              ↓
                           FAILED


### 5. Manual retry

text
FAILED
   ↓
manual retry
   ↓
PENDING
   ↓
worker processes again


### 6. Parallel slow events

Multiple slow events can be processed concurrently by Worker 1 and Worker 2.

### 7. Worker crash

text
Worker 1
   ↓
claims event
   ↓
worker crashes
   ↓
lease expires
   ↓
Worker 2 recovers event
   ↓
processes event


### 8. Burst processing

500 events can be submitted and processed by the worker pool.

---

# Configuration

The main configuration values are:

text
PORT=3000

DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=webhook_processor

MAX_ATTEMPTS=5
LEASE_TIMEOUT_SECONDS=30
BASE_RETRY_DELAY_SECONDS=5


---

# Why PostgreSQL Is Used as the Queue

A dedicated message broker such as RabbitMQ or Kafka could be used for the worker queue.

For this assessment, PostgreSQL-backed workers were chosen because the primary requirements are durable persistence, duplicate protection, concurrent claiming, retry scheduling, and crash recovery.

Using PostgreSQL for both persistence and the work queue keeps the architecture small while still allowing correctness guarantees through database transactions, row-level locking, unique constraints, and leases.

A dedicated queue could be introduced if the system needed substantially higher throughput or more advanced messaging semantics.

---

# Correctness Guarantees

The system relies on database-level guarantees rather than only application logic.

### Duplicate protection

Unique constraint:


webhook_events.event_id


and:


processed_orders.event_id


### Concurrent worker safety

PostgreSQL:


FOR UPDATE SKIP LOCKED


### Crash recovery

Lease:


locked_at
locked_by


### Retry

Persistent:


attempt_count
next_attempt_at


### Auditability

Persistent:


processing_attempts


---

# Limitations

This implementation intentionally keeps the system small for the assessment.

Current limitations include:

* PostgreSQL is also being used as the work queue.
* `synchronize: true` is used for local development rather than migrations.
* No authentication or authorization.
* No rate limiting.
* No external downstream service.
* No distributed tracing.
* No metrics/alerting system.
* Retry scheduling is implemented with database polling.
* The operations dashboard is intentionally simple.

These are acceptable trade-offs for the scope of this assessment.

---

# Hardest Engineering Problem

The hardest part of the implementation is ensuring that worker crashes do not leave events permanently stuck while also preventing two workers from processing the same event simultaneously.

A simple `PROCESSING` status is not sufficient because a worker can die after claiming an event.

The solution combines:

1. PostgreSQL row locking for atomic claiming.
2. `locked_by` to identify ownership.
3. `locked_at` as a lease timestamp.
4. Periodic lease renewal for long-running work.
5. Stale lease recovery.
6. Database uniqueness on `processed_orders.event_id`.
7. Ownership checks before final state transitions.

This provides both concurrency control and crash recovery without introducing a separate distributed lock service.

---

# Future Improvements

If this system were extended beyond the assessment, the next improvements would be:

1. Replace database polling with a dedicated message broker such as RabbitMQ or Kafka where appropriate.
2. Add database migrations instead of `synchronize`.
3. Add structured logging.
4. Add metrics for throughput, retries, failures, and processing latency.
5. Add distributed tracing.
6. Add configurable jitter to retry delays.
7. Add dead-letter handling for permanently failed events.
8. Add authentication and authorization to the operations API.
9. Add more comprehensive integration and failure-injection tests.
10. Add horizontal worker scaling.

---

# Running Tests

Backend tests:

bash
cd backend
npm test


For the complete system:

bash
docker compose up -d --build


Then execute the webhook scenarios described above.

---

# Stopping the Application

bash
docker compose down


To also remove the PostgreSQL volume:

bash
docker compose down -v


> Warning: `docker compose down -v` deletes the PostgreSQL data volume.
