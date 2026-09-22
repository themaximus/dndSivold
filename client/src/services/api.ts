import { User, Character, Room, RoomPlayer, GameLogEntry, UserRoomSummary } from '../types';

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

  let data: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text = await res.text();
      data = { error: text };
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    throw new Error(data?.error || `Ошибка сервера (${res.status})`);
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

  async restoreSession(username: string, userId?: string): Promise<{ token: string; user: User; restored?: boolean }> {
    const res = await request<{ token: string; user: User; restored?: boolean }>('/auth/restore-session', {
      method: 'POST',
      body: JSON.stringify({ username, userId }),
    });
    setAuthToken(res.token);
    return res;
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

  async syncBackupCharacters(characters: Character[]): Promise<{ success: boolean; restoredCount: number; characters: Character[] }> {
    return request<{ success: boolean; restoredCount: number; characters: Character[] }>('/characters/sync-backup', {
      method: 'POST',
      body: JSON.stringify({ characters }),
    });
  },

  async learnTalent(characterId: string, talentId: string): Promise<Character> {
    return request<Character>(`/characters/${characterId}/talents`, {
      method: 'POST',
      body: JSON.stringify({ talentId }),
    });
  },

  async shortRest(characterId: string, diceCount?: number): Promise<{
    character: Character;
    healedHp: number;
    diceSpent: number;
    rolls: number[];
  }> {
    return request<{
      character: Character;
      healedHp: number;
      diceSpent: number;
      rolls: number[];
    }>(`/characters/${characterId}/rest/short`, {
      method: 'POST',
      body: JSON.stringify({ diceCount }),
    });
  },

  async longRest(characterId: string): Promise<{
    character: Character;
    healedHp: number;
  }> {
    return request<{
      character: Character;
      healedHp: number;
    }>(`/characters/${characterId}/rest/long`, {
      method: 'POST',
    });
  },

  // Rooms
  async createRoom(data: {
    title: string;
    setting: string;
    genre?: string;
    campaignDuration?: 'short' | 'medium' | 'long';
    turnMode?: 'simultaneous' | 'turn_by_turn';
    deepseekApiKey?: string;
    deepseekModel?: string;
  }): Promise<Room> {
    return request<Room>('/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async generateStory(params?: {
    genre?: string;
    campaignDuration?: 'short' | 'medium' | 'long';
    deepseekApiKey?: string;
    deepseekModel?: string;
  }): Promise<{
    title: string;
    setting: string;
    genre: string;
    campaignDuration: 'short' | 'medium' | 'long';
  }> {
    try {
      return await request('/rooms/generate-story', {
        method: 'POST',
        body: JSON.stringify(params || {}),
      });
    } catch {
      try {
        return await request('/generate-story', {
          method: 'POST',
          body: JSON.stringify(params || {}),
        });
      } catch {
        const g = (params?.genre as any) || 'fantasy';
        const d = (params?.campaignDuration as any) || 'medium';
        return {
          title: 'Караван на Перепутье Семи Дорог',
          setting: 'На широкой развилке древних трактов встал лагерем торговый караван купца Бальтазара. Сломанное колесо повозки задерживает путь, а возницы шепчутся о странных огнях в чащобе. Купец ищет спутников, предлагает редкие диковинки и готов щедро наградить за помощь и охрану в пути.',
          genre: g,
          campaignDuration: d,
        };
      }
    }
  },

  async getRoomByCode(code: string): Promise<{ room: Room; players: RoomPlayer[]; logs: GameLogEntry[] }> {
    return request<{ room: Room; players: RoomPlayer[]; logs: GameLogEntry[] }>(`/rooms/${code}`);
  },

  async getMyRooms(): Promise<UserRoomSummary[]> {
    return request<UserRoomSummary[]>('/rooms/my');
  },

  async joinRoom(code: string): Promise<{ room: Room; players: RoomPlayer[] }> {
    return request<{ room: Room; players: RoomPlayer[] }>(`/rooms/${code}/join`, {
      method: 'POST',
    });
  },

  async updateRoomSettings(code: string, settings: { deepseekApiKey?: string; deepseekModel?: string }): Promise<Room> {
    return request<Room>(`/rooms/${code}/settings`, {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }
};
