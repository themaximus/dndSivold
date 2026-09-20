import { User, Character, Room, RoomPlayer, GameLogEntry } from '../types';

const API_BASE = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('dnd_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('dnd_token', token);
  } else {
    localStorage.removeItem('dnd_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Произошла ошибка при запросе');
  }
  return data;
}

export const api = {
  // Auth
  async register(username: string, password: string): Promise<{ token: string; user: User }> {
    const res = await request<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setAuthToken(res.token);
    return res;
  },

  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    const res = await request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setAuthToken(res.token);
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return request<{ user: User }>('/auth/me');
  },

  // Characters
  async getCharacters(): Promise<Character[]> {
    return request<Character[]>('/characters');
  },

  async getCharacter(id: string): Promise<Character> {
    return request<Character>(`/characters/${id}`);
  },

  async createCharacter(characterData: Partial<Character>): Promise<Character> {
    return request<Character>('/characters', {
      method: 'POST',
      body: JSON.stringify(characterData),
    });
  },

  async deleteCharacter(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/characters/${id}`, {
      method: 'DELETE',
    });
  },

  // Rooms
  async createRoom(data: {
    title: string;
    setting: string;
    deepseekApiKey?: string;
    deepseekModel?: string;
  }): Promise<Room> {
    return request<Room>('/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getRoomByCode(code: string): Promise<{ room: Room; players: RoomPlayer[]; logs: GameLogEntry[] }> {
    return request<{ room: Room; players: RoomPlayer[]; logs: GameLogEntry[] }>(`/rooms/${code}`);
  },

  async updateRoomSettings(code: string, settings: { deepseekApiKey?: string; deepseekModel?: string }): Promise<Room> {
    return request<Room>(`/rooms/${code}/settings`, {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }
};
