/**
 * Google Calendar API Service
 * Handles listing, creating, and deleting Google Calendar events via OAuth token
 */

export interface GoogleCalendarEventItem {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  htmlLink?: string;
  status?: string;
}

/**
 * List upcoming events from primary Google Calendar
 */
export async function listGoogleCalendarEvents(
  accessToken: string,
  options: { maxResults?: number; timeMin?: string } = {}
): Promise<GoogleCalendarEventItem[]> {
  const maxResults = options.maxResults || 25;
  const timeMin = options.timeMin || new Date().toISOString();

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('maxResults', maxResults.toString());
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error al listar eventos de Google Calendar: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  return (data.items || []).map((item: any) => ({
    id: item.id,
    summary: item.summary || 'Evento sin título',
    description: item.description,
    location: item.location,
    start: item.start || {},
    end: item.end || {},
    htmlLink: item.htmlLink,
    status: item.status,
  }));
}

/**
 * Create a new event in Google Calendar
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    startDateTime: string; // ISO string
    endDateTime: string; // ISO string
  }
): Promise<GoogleCalendarEventItem> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: {
        dateTime: event.startDateTime,
      },
      end: {
        dateTime: event.endDateTime,
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error al crear evento en Google Calendar: ${res.status} - ${errorText}`);
  }

  return await res.json();
}

/**
 * Delete an event from Google Calendar (Requires prior confirmation)
 */
export async function deleteGoogleCalendarEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok && res.status !== 404) {
    const errorText = await res.text();
    throw new Error(`Error al eliminar evento de Google Calendar: ${res.status} - ${errorText}`);
  }
}
