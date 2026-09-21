import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { CharacterList } from './components/CharacterList';
import { CharacterCreator } from './components/CharacterCreator';
import { CreateRoomModal } from './components/CreateRoomModal';
import { MyCampaignsList } from './components/MyCampaignsList';
import { RoomLobby } from './components/RoomLobby';
import { GameTable } from './components/GameTable';
import { api } from './services/api';
import { Character } from './types';
import { AppView, parseRoute, buildUrl } from './utils/navigation';

export function App() {
  const { user, loading } = useAuth();
  
  // Parse initial route directly from URL search params & pathname
  const initialRoute = parseRoute();
  const [currentView, setCurrentView] = useState<AppView>(initialRoute.view);
  const [activeRoomCode, setActiveRoomCode] = useState<string>(initialRoute.roomCode);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoadingChars, setIsLoadingChars] = useState(false);

  // Navigate to a view and update the browser URL & history
  const navigateTo = useCallback((view: AppView, roomCode?: string, replace: boolean = false) => {
    let targetRoomCode = '';
    if (roomCode !== undefined) {
      targetRoomCode = roomCode.toUpperCase().trim();
    } else if (view === 'game' || view === 'lobby') {
      targetRoomCode = activeRoomCode;
    } else if (view === 'create-character' && activeRoomCode) {
      targetRoomCode = activeRoomCode;
    }

    const newUrl = buildUrl(view, targetRoomCode);
    if (replace) {
      window.history.replaceState({ view, roomCode: targetRoomCode }, '', newUrl);
    } else {
      window.history.pushState({ view, roomCode: targetRoomCode }, '', newUrl);
    }

    setCurrentView(view);
    setActiveRoomCode(targetRoomCode);
  }, [activeRoomCode]);

  // Initial URL normalization & popstate listener for back/forward browser navigation
  useEffect(() => {
    // If opened with bare '/', format URL to /?tab=characters without adding history stack entry
    if (!window.location.search && (!window.location.pathname || window.location.pathname === '/')) {
      window.history.replaceState({ view: 'characters', roomCode: '' }, '', buildUrl('characters'));
    }

    const handlePopState = () => {
      const route = parseRoute();
      setCurrentView(route.view);
      setActiveRoomCode(route.roomCode);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const loadCharacters = async () => {
    if (!user) return;
    setIsLoadingChars(true);
    try {
      const data = await api.getCharacters();
      if (Array.isArray(data) && data.length > 0) {
        setCharacters(data);
        localStorage.setItem(`dnd_characters_cache_${user.id}`, JSON.stringify(data));
      } else {
        // If server has 0 characters (e.g. after container redeploy), auto-restore from client-side backup!
        const cachedStr = localStorage.getItem(`dnd_characters_cache_${user.id}`);
        if (cachedStr) {
          try {
            const cachedChars: Character[] = JSON.parse(cachedStr);
            if (Array.isArray(cachedChars) && cachedChars.length > 0) {
              const syncRes = await api.syncBackupCharacters(cachedChars);
              if (syncRes.characters && syncRes.characters.length > 0) {
                setCharacters(syncRes.characters);
                return;
              }
            }
          } catch (e) {
            console.warn('Error syncing cached characters:', e);
          }
        }
        setCharacters(data || []);
      }
    } catch (err) {
      console.error('Failed to load characters', err);
      // Fallback to offline/cached characters
      const cachedStr = localStorage.getItem(`dnd_characters_cache_${user.id}`);
      if (cachedStr) {
        try {
          const cachedChars: Character[] = JSON.parse(cachedStr);
          if (Array.isArray(cachedChars) && cachedChars.length > 0) {
            setCharacters(cachedChars);
          }
        } catch (e) {}
      }
    } finally {
      setIsLoadingChars(false);
    }
  };

  useEffect(() => {
    if (user && (currentView === 'characters' || currentView === 'lobby')) {
      loadCharacters();
    }
  }, [user, currentView]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-rpg">Загрузка приключения...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0d0f12]">
        <Navbar currentView={currentView} setCurrentView={navigateTo} />
        <AuthModal />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0f12] flex flex-col">
      <Navbar currentView={currentView} setCurrentView={navigateTo} />

      <main className="flex-1">
        {currentView === 'characters' && (
          <CharacterList
            characters={characters}
            onCreateNew={() => navigateTo('create-character')}
            onRefresh={loadCharacters}
          />
        )}

        {currentView === 'create-character' && (
          <CharacterCreator
            onCreated={(newChar) => {
              setCharacters((prev) => [...prev, newChar]);
              if (activeRoomCode) {
                navigateTo('lobby', activeRoomCode);
              } else {
                navigateTo('characters');
              }
            }}
            onCancel={() => {
              if (activeRoomCode) {
                navigateTo('lobby', activeRoomCode);
              } else {
                navigateTo('characters');
              }
            }}
          />
        )}

        {currentView === 'create-room' && (
          <CreateRoomModal
            onRoomCreated={(code) => {
              navigateTo('lobby', code);
            }}
            onCancel={() => navigateTo('campaigns')}
          />
        )}

        {currentView === 'campaigns' && (
          <MyCampaignsList
            onEnterRoom={(code) => {
              navigateTo('lobby', code);
            }}
            onCreateRoom={() => navigateTo('create-room')}
          />
        )}

        {currentView === 'lobby' && activeRoomCode && (
          <RoomLobby
            roomCode={activeRoomCode}
            onGameStarted={() => navigateTo('game', activeRoomCode)}
            onCreateCharacter={() => navigateTo('create-character', activeRoomCode)}
            onLeave={() => {
              navigateTo('campaigns', '');
            }}
          />
        )}

        {currentView === 'game' && activeRoomCode && (
          <GameTable
            roomCode={activeRoomCode}
            onLeave={() => {
              navigateTo('lobby', activeRoomCode);
            }}
          />
        )}
      </main>
    </div>
  );
}

export default App;
