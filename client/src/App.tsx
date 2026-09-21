import React, { useState, useEffect } from 'react';
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

export function App() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<string>('characters');
  const [activeRoomCode, setActiveRoomCode] = useState<string>('');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoadingChars, setIsLoadingChars] = useState(false);

  // Check URL query param e.g. ?room=DUNGEON-123
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setActiveRoomCode(roomParam.toUpperCase());
      setCurrentView('lobby');
    }
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
        <Navbar currentView={currentView} setCurrentView={setCurrentView} />
        <AuthModal />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0f12] flex flex-col">
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />

      <main className="flex-1">
        {currentView === 'characters' && (
          <CharacterList
            characters={characters}
            onCreateNew={() => setCurrentView('create-character')}
            onRefresh={loadCharacters}
          />
        )}

        {currentView === 'create-character' && (
          <CharacterCreator
            onCreated={(newChar) => {
              setCharacters((prev) => [...prev, newChar]);
              setCurrentView('characters');
            }}
            onCancel={() => setCurrentView('characters')}
          />
        )}

        {currentView === 'create-room' && (
          <CreateRoomModal
            onRoomCreated={(code) => {
              setActiveRoomCode(code);
              // Update URL without reload
              window.history.pushState({}, '', `/?room=${code}`);
              setCurrentView('lobby');
            }}
            onCancel={() => setCurrentView('campaigns')}
          />
        )}

        {currentView === 'campaigns' && (
          <MyCampaignsList
            onEnterRoom={(code) => {
              setActiveRoomCode(code);
              window.history.pushState({}, '', `/?room=${code}`);
              setCurrentView('lobby');
            }}
            onCreateRoom={() => setCurrentView('create-room')}
          />
        )}

        {currentView === 'lobby' && activeRoomCode && (
          <RoomLobby
            roomCode={activeRoomCode}
            onGameStarted={() => setCurrentView('game')}
            onLeave={() => {
              window.history.pushState({}, '', '/');
              setActiveRoomCode('');
              setCurrentView('campaigns');
            }}
          />
        )}

        {currentView === 'game' && activeRoomCode && (
          <GameTable
            roomCode={activeRoomCode}
            onLeave={() => {
              setCurrentView('lobby');
            }}
          />
        )}
      </main>
    </div>
  );
}

export default App;
