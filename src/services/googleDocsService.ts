/**
 * Google Docs & Drive API Service
 * Handles listing, retrieving, creating, and updating Google Docs
 */

export interface GoogleDocSummary {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface GoogleDocContent {
  documentId: string;
  title: string;
  bodyText: string;
  revisionId?: string;
}

/**
 * List Google Docs belonging to the user via Drive API
 */
export async function listGoogleDocs(
  accessToken: string,
  pageSize = 20
): Promise<GoogleDocSummary[]> {
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', "mimeType='application/vnd.google-apps.document' and trashed=false");
  url.searchParams.set('fields', 'files(id, name, modifiedTime, webViewLink)');
  url.searchParams.set('orderBy', 'modifiedTime desc');
  url.searchParams.set('pageSize', pageSize.toString());

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error al listar documentos de Google Docs: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name || 'Documento sin título',
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink,
  }));
}

/**
 * Get full document structure and extract readable text from Google Docs API
 */
export async function getGoogleDoc(
  accessToken: string,
  documentId: string
): Promise<GoogleDocContent> {
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error al leer el documento de Google Docs: ${res.status} - ${errorText}`);
  }

  const doc = await res.json();
  let extractedText = '';

  if (doc.body?.content) {
    for (const elem of doc.body.content) {
      if (elem.paragraph?.elements) {
        for (const pe of elem.paragraph.elements) {
          if (pe.textRun?.content) {
            extractedText += pe.textRun.content;
          }
        }
      }
    }
  }

  return {
    documentId: doc.documentId,
    title: doc.title || 'Documento sin título',
    bodyText: extractedText.trim(),
    revisionId: doc.revisionId,
  };
}

/**
 * Create a new Google Doc and optionally populate initial text
 */
export async function createGoogleDoc(
  accessToken: string,
  title: string,
  initialText?: string
): Promise<GoogleDocSummary> {
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: title || 'Nuevo Documento VVC LIAM CORE',
    }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Error al crear documento en Google Docs: ${createRes.status} - ${errorText}`);
  }

  const createdDoc = await createRes.json();
  const documentId = createdDoc.documentId;

  // If initial text is provided, insert it into the document
  if (initialText && initialText.trim().length > 0) {
    await insertTextIntoGoogleDoc(accessToken, documentId, initialText);
  }

  return {
    id: documentId,
    name: createdDoc.title || title,
    webViewLink: `https://docs.google.com/document/d/${documentId}/edit`,
  };
}

/**
 * Insert text at the start or end of a Google Doc
 */
export async function insertTextIntoGoogleDoc(
  accessToken: string,
  documentId: string,
  text: string
): Promise<void> {
  const res = await fetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: {
                index: 1,
              },
              text: text + '\n',
            },
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error al insertar texto en Google Doc: ${res.status} - ${errorText}`);
  }
}
