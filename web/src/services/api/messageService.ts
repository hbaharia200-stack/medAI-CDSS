import { apiFetch } from './client';

export interface StaffDirectoryEntry {
  id: string;
  fullName: string;
  role: 'doctor' | 'nurse';
  staffId: string;
  specialization?: string;
}

export interface ChatRoom {
  id: string;
  name?: string;
  isGroup: boolean;
  createdAt: string;
  createdBy?: string;
  participantIds: string[];
}

export interface ChatAttachment {
  id?: string;
  filename: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  body?: string;
  createdAt: string;
  read: boolean;
  attachments: ChatAttachment[];
}

interface ApiResponse<T> { data: T }

export async function listStaff(role: 'doctor' | 'nurse' = 'doctor'): Promise<StaffDirectoryEntry[]> {
  const response = await apiFetch<ApiResponse<StaffDirectoryEntry[]>>(`/staff?role=${role}`);
  return response.data;
}

export async function listRooms(): Promise<ChatRoom[]> {
  const response = await apiFetch<ApiResponse<ChatRoom[]>>('/chat-rooms');
  return response.data;
}

export async function createRoom(participantIds: string[], name?: string): Promise<ChatRoom> {
  const response = await apiFetch<ApiResponse<ChatRoom>>('/chat-rooms', {
    method: 'POST',
    body: JSON.stringify({ participantIds, name, isGroup: participantIds.length > 1 }),
  });
  return response.data;
}

export async function listMessages(roomId: string): Promise<ChatMessage[]> {
  const response = await apiFetch<ApiResponse<ChatMessage[]>>(`/messages?roomId=${encodeURIComponent(roomId)}`);
  return response.data;
}

export async function sendMessage(roomId: string, body?: string, attachments: ChatAttachment[] = []): Promise<ChatMessage> {
  const response = await apiFetch<ApiResponse<ChatMessage>>('/messages', {
    method: 'POST',
    body: JSON.stringify({ roomId, body, attachments }),
  });
  return response.data;
}

export async function markRoomRead(roomId: string): Promise<void> {
  await apiFetch(`/chat-rooms/${encodeURIComponent(roomId)}/read`, { method: 'POST' });
}
