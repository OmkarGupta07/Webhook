'use client';

import { useEffect, useState } from 'react';

type Event = {
  id: string;
  eventId: string;
  type: string;
  status: string;
  attemptCount: number;
  nextAttemptAt: string;
  createdAt: string;
};

type Attempt = {
  id: string;
  eventId: string;
  attemptNumber: number;
  workerId: string;
  startedAt: string;
  finishedAt: string | null;
  result: string;
  error: string | null;
};

type EventDetails = {
  event: Event;
  attempts: Attempt[];
};

const API_URL = 'http://localhost:3000';

export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selected, setSelected] =
    useState<EventDetails | null>(null);

  const [loading, setLoading] = useState(true);

  async function loadEvents() {
    try {
      const response = await fetch(
        `${API_URL}/operations/events`,
        {
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        throw new Error(
          'Failed to fetch events',
        );
      }

      const data = await response.json();

      setEvents(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadEvent(
    eventId: string,
  ) {
    try {
      const response = await fetch(
        `${API_URL}/operations/events/${eventId}`,
        {
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        throw new Error(
          'Failed to fetch event',
        );
      }

      const data = await response.json();

      setSelected(data);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    loadEvents();

    const interval = setInterval(
      loadEvents,
      3000,
    );

    return () =>
      clearInterval(interval);
  }, []);

  async function retryEvent(
    eventId: string,
  ) {
    try {
      await fetch(
        `${API_URL}/webhooks/${eventId}/retry`,
        {
          method: 'POST',
        },
      );

      await loadEvents();
      await loadEvent(eventId);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <main
      style={{
        padding: '40px',
        fontFamily: 'Arial',
      }}
    >
      <h1>Reliable Webhook Processor</h1>

      <p>
        Operations Dashboard
      </p>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table
          border={1}
          cellPadding={10}
          style={{
            borderCollapse: 'collapse',
            width: '100%',
          }}
        >
          <thead>
            <tr>
              <th>Event ID</th>
              <th>Type</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {events.map((event) => (
              <tr key={event.eventId}>
                <td>{event.eventId}</td>

                <td>{event.type}</td>

                <td>{event.status}</td>

                <td>
                  {event.attemptCount}
                </td>

                <td>
                  {new Date(
                    event.createdAt,
                  ).toLocaleString()}
                </td>

                <td>
                  <button
                    onClick={() =>
                      loadEvent(
                        event.eventId,
                      )
                    }
                  >
                    Details
                  </button>

                  {event.status ===
                    'FAILED' && (
                    <button
                      onClick={() =>
                        retryEvent(
                          event.eventId,
                        )
                      }
                      style={{
                        marginLeft: '8px',
                      }}
                    >
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <section
          style={{
            marginTop: '40px',
          }}
        >
          <h2>
            Event Details
          </h2>

          <p>
            <strong>
              Event ID:
            </strong>{' '}
            {selected.event.eventId}
          </p>

          <p>
            <strong>
              Status:
            </strong>{' '}
            {selected.event.status}
          </p>

          <p>
            <strong>
              Attempts:
            </strong>{' '}
            {selected.event.attemptCount}
          </p>

          <h3>
            Processing History
          </h3>

          <table
            border={1}
            cellPadding={10}
            style={{
              borderCollapse:
                'collapse',
              width: '100%',
            }}
          >
            <thead>
              <tr>
                <th>
                  Attempt
                </th>
                <th>
                  Worker
                </th>
                <th>
                  Result
                </th>
                <th>
                  Started
                </th>
                <th>
                  Finished
                </th>
                <th>
                  Error
                </th>
              </tr>
            </thead>

            <tbody>
              {selected.attempts.map(
                (attempt) => (
                  <tr key={attempt.id}>
                    <td>
                      {
                        attempt.attemptNumber
                      }
                    </td>

                    <td>
                      {attempt.workerId}
                    </td>

                    <td>
                      {attempt.result}
                    </td>

                    <td>
                      {new Date(
                        attempt.startedAt,
                      ).toLocaleString()}
                    </td>

                    <td>
                      {attempt.finishedAt
                        ? new Date(
                            attempt.finishedAt,
                          ).toLocaleString()
                        : '-'}
                    </td>

                    <td>
                      {attempt.error ||
                        '-'}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}