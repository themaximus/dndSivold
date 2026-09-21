export type AppView = 'characters' | 'campaigns' | 'create-room' | 'create-character' | 'lobby' | 'game';

export interface RouteState {
  view: AppView;
  roomCode: string;
  hudTab?: 'threats' | 'npcs' | 'all';
}

/**
 * Parses current location (search params and pathname) into RouteState
 */
export function parseRoute(): RouteState {
  if (typeof window === 'undefined') {
    return { view: 'characters', roomCode: '' };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname.replace(/\/+$/, '').toLowerCase();

  let room = (searchParams.get('room') || '').toUpperCase().trim();
  let tab = (searchParams.get('tab') || searchParams.get('view') || '').toLowerCase().trim();
  const hud = searchParams.get('hud');
  const hudTab = (hud === 'threats' || hud === 'npcs' || hud === 'all') ? hud : undefined;

  // Support path-based URLs as well
  if (!tab && !room) {
    if (pathname === '/campaigns') {
      tab = 'campaigns';
    } else if (pathname === '/create-room') {
      tab = 'create-room';
    } else if (pathname === '/create-character') {
      tab = 'create-character';
    } else if (pathname === '/characters' || pathname === '') {
      tab = 'characters';
    } else if (pathname.startsWith('/room/')) {
      const parts = pathname.slice('/room/'.length).split('/');
      room = (parts[0] || '').toUpperCase().trim();
      if (parts[1] === 'game') {
        tab = 'game';
      } else {
        tab = 'lobby';
      }
    }
  }

  // If a room is specified
  if (room) {
    if (tab === 'game') {
      return { view: 'game', roomCode: room, hudTab };
    }
    if (tab === 'create-character') {
      return { view: 'create-character', roomCode: room, hudTab };
    }
    return { view: 'lobby', roomCode: room, hudTab };
  }

  // Top level tabs
  if (tab === 'campaigns') return { view: 'campaigns', roomCode: '', hudTab };
  if (tab === 'create-room') return { view: 'create-room', roomCode: '', hudTab };
  if (tab === 'create-character') return { view: 'create-character', roomCode: '', hudTab };

  return { view: 'characters', roomCode: '', hudTab };
}

/**
 * Builds standard URL from view and optional roomCode
 */
export function buildUrl(view: AppView, roomCode?: string, hudTab?: string): string {
  const cleanCode = (roomCode || '').toUpperCase().trim();
  const params = new URLSearchParams();

  if (cleanCode) {
    params.set('room', cleanCode);
    if (view === 'game') {
      params.set('tab', 'game');
      if (hudTab && ['threats', 'npcs', 'all'].includes(hudTab)) {
        params.set('hud', hudTab);
      }
    } else if (view === 'create-character') {
      params.set('tab', 'create-character');
    } else {
      params.set('tab', 'lobby');
    }
    return `/?${params.toString()}`;
  }

  if (view === 'campaigns') {
    params.set('tab', 'campaigns');
    return `/?${params.toString()}`;
  }
  if (view === 'create-room') {
    params.set('tab', 'create-room');
    return `/?${params.toString()}`;
  }
  if (view === 'create-character') {
    params.set('tab', 'create-character');
    return `/?${params.toString()}`;
  }

  // characters tab
  params.set('tab', 'characters');
  return `/?${params.toString()}`;
}
