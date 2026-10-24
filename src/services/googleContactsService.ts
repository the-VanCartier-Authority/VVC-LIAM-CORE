/**
 * Google Contacts (People API) Service
 * Handles listing, adding, and deleting contacts via Google People API
 */

import type { PhoneContact } from '../types';

export interface GoogleContactItem {
  resourceName: string;
  etag?: string;
  name: string;
  phoneNumber?: string;
  email?: string;
  photoUrl?: string;
}

/**
 * List contacts from Google People API
 */
export async function listGoogleContacts(
  accessToken: string,
  pageSize = 50
): Promise<GoogleContactItem[]> {
  const url = new URL('https://people.googleapis.com/v1/people/me/connections');
  url.searchParams.set('personFields', 'names,phoneNumbers,emailAddresses,photos');
  url.searchParams.set('pageSize', pageSize.toString());
  url.searchParams.set('sortOrder', 'FIRST_NAME_ASCENDING');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error al listar contactos de Google: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  const connections = data.connections || [];

  return connections.map((c: any) => {
    const name =
      c.names?.[0]?.displayName ||
      c.names?.[0]?.givenName ||
      c.emailAddresses?.[0]?.value ||
      'Sin nombre';
    const phoneNumber = c.phoneNumbers?.[0]?.value || '';
    const email = c.emailAddresses?.[0]?.value || '';
    const photoUrl = c.photos?.[0]?.url || '';

    return {
      resourceName: c.resourceName,
      etag: c.etag,
      name,
      phoneNumber,
      email,
      photoUrl,
    };
  });
}

/**
 * Convert Google Contacts to PhoneContact format used in VAOS
 */
export function convertGoogleContactsToPhoneContacts(
  items: GoogleContactItem[]
): PhoneContact[] {
  return items.map((item): PhoneContact => ({
    id: `google-${item.resourceName.replace('/', '-')}`,
    name: item.name,
    phone: item.phoneNumber?.trim() || '',
    email: item.email,
    avatar: item.photoUrl,
    isGoogleContact: true,
  }));
}

/**
 * Create a new Contact in Google Contacts
 */
export async function createGoogleContact(
  accessToken: string,
  contact: {
    givenName: string;
    familyName?: string;
    phoneNumber?: string;
    email?: string;
  }
): Promise<GoogleContactItem> {
  const body: any = {
    names: [
      {
        givenName: contact.givenName,
        familyName: contact.familyName || '',
      },
    ],
  };

  if (contact.phoneNumber) {
    body.phoneNumbers = [{ value: contact.phoneNumber, type: 'mobile' }];
  }
  if (contact.email) {
    body.emailAddresses = [{ value: contact.email, type: 'home' }];
  }

  const res = await fetch('https://people.googleapis.com/v1/people:createContact', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error al crear contacto en Google: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  return {
    resourceName: data.resourceName,
    name: data.names?.[0]?.displayName || contact.givenName,
    phoneNumber: data.phoneNumbers?.[0]?.value || contact.phoneNumber,
    email: data.emailAddresses?.[0]?.value || contact.email,
  };
}

/**
 * Delete a contact in Google Contacts (Requires prior confirmation)
 */
export async function deleteGoogleContact(
  accessToken: string,
  resourceName: string
): Promise<void> {
  const res = await fetch(
    `https://people.googleapis.com/v1/${resourceName}:deleteContact`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok && res.status !== 404) {
    const errorText = await res.text();
    throw new Error(`Error al eliminar contacto de Google: ${res.status} - ${errorText}`);
  }
}
