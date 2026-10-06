import { getAccessToken } from './googleAuth';

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
}

export interface GmailMessageDetail extends GmailMessageSummary {
  body: string;
  to?: string;
}

/**
 * Decode RFC 2822 base64url string to readable UTF-8 text
 */
function decodeBase64Url(str: string): string {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const binStr = atob(base64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (e) {
    return str;
  }
}

/**
 * Fetch list of recent emails from Gmail
 */
export async function listGmailMessages(maxResults = 10): Promise<GmailMessageSummary[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED: Inicia sesión con Google para ver tus correos.');
  }

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!listRes.ok) {
    if (listRes.status === 401) {
      throw new Error('TOKEN_EXPIRED: La sesión ha expirado. Por favor reconecta tu cuenta.');
    }
    throw new Error(`Error al consultar Gmail (${listRes.status})`);
  }

  const listData = await listRes.json();
  const messages = listData.messages || [];

  // Fetch metadata details for each message
  const detailedMessages = await Promise.all(
    messages.slice(0, maxResults).map(async (m: { id: string; threadId: string }) => {
      try {
        const detailRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!detailRes.ok) return null;
        const detail = await detailRes.json();
        const headers = detail.payload?.headers || [];

        const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject');
        const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from');
        const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date');

        const isUnread = detail.labelIds?.includes('UNREAD') || false;

        return {
          id: detail.id,
          threadId: detail.threadId,
          from: fromHeader ? fromHeader.value : 'Desconocido',
          subject: subjectHeader ? subjectHeader.value : '(Sin asunto)',
          snippet: detail.snippet || '',
          date: dateHeader ? new Date(dateHeader.value).toLocaleString() : '',
          isUnread,
        };
      } catch {
        return null;
      }
    })
  );

  return detailedMessages.filter(Boolean) as GmailMessageSummary[];
}

/**
 * Fetch full body of a specific email
 */
export async function getGmailMessageDetail(messageId: string): Promise<GmailMessageDetail> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Error al obtener detalle del correo (${res.status})`);
  }

  const data = await res.json();
  const headers = data.payload?.headers || [];
  const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject');
  const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from');
  const toHeader = headers.find((h: any) => h.name.toLowerCase() === 'to');
  const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date');

  let body = '';
  if (data.payload?.body?.data) {
    body = decodeBase64Url(data.payload.body.data);
  } else if (data.payload?.parts) {
    // Look for text/plain or text/html part
    const textPart =
      data.payload.parts.find((p: any) => p.mimeType === 'text/plain') ||
      data.payload.parts.find((p: any) => p.mimeType === 'text/html') ||
      data.payload.parts[0];
    if (textPart?.body?.data) {
      body = decodeBase64Url(textPart.body.data);
    }
  }

  if (!body) {
    body = data.snippet || '(Sin contenido legible)';
  }

  return {
    id: data.id,
    threadId: data.threadId,
    from: fromHeader?.value || 'Desconocido',
    to: toHeader?.value || '',
    subject: subjectHeader?.value || '(Sin asunto)',
    snippet: data.snippet || '',
    date: dateHeader ? new Date(dateHeader.value).toLocaleString() : '',
    isUnread: data.labelIds?.includes('UNREAD') || false,
    body,
  };
}

/**
 * Send an email via Gmail API
 * Note: Must be preceded by explicit user confirmation in UI
 */
export async function sendGmailEmail(to: string, subject: string, bodyText: string): Promise<{ id: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED: Debes iniciar sesión para enviar correos.');

  // Construct RFC 2822 email format
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    bodyText,
  ];
  const emailRaw = messageParts.join('\r\n');

  // Base64URL encode the message
  const encodedEmail = btoa(unescape(encodeURIComponent(emailRaw)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedEmail }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Error al enviar correo (${res.status})`);
  }

  return await res.json();
}
