// Public contact messages (landing-page Contact form) + the staff inbox.
//
// These are the website's own enquiries, NOT the clinical staff chat
// (`/api/messages`). Keeping them on separate endpoints is what stops an
// anonymous visitor's message from ever appearing inside a staff conversation.

import { apiFetch } from './client';

export type ContactMessageStatus = 'new' | 'read' | 'replied';

export interface ContactMessage {
  id: string;
  name: string;
  message: string;
  /** Always "website_contact_form" today. */
  source: string;
  status: ContactMessageStatus;
  createdAt: string | null;
  readAt: string | null;
}

/**
 * Submit a public enquiry. No authentication — the visitor has no account.
 *
 * Throws if the backend rejected it, so the UI never claims success for a
 * message that was not actually stored.
 */
export async function submitContactMessage(input: {
  name: string;
  message: string;
}): Promise<ContactMessage> {
  const response = await apiFetch<{ data: ContactMessage }>('/contact-messages', {
    method: 'POST',
    body: JSON.stringify({ name: input.name, message: input.message }),
  });
  return response.data;
}

/** Staff inbox. Doctor/nurse/admin only (the API rejects patients). */
export async function listContactMessages(params: {
  status?: ContactMessageStatus;
  limit?: number;
} = {}): Promise<ContactMessage[]> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await apiFetch<{ data: ContactMessage[] }>(`/contact-messages${suffix}`);
  return response.data;
}

export async function getContactMessage(id: string): Promise<ContactMessage> {
  const response = await apiFetch<{ data: ContactMessage }>(`/contact-messages/${id}`);
  return response.data;
}

/** Advance new -> read -> replied. */
export async function setContactMessageStatus(
  id: string,
  status: ContactMessageStatus,
): Promise<ContactMessage> {
  const response = await apiFetch<{ data: ContactMessage }>(`/contact-messages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return response.data;
}

export const contactService = {
  submitContactMessage,
  listContactMessages,
  getContactMessage,
  setContactMessageStatus,
};

export default contactService;