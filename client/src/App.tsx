import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { CharacterList } from './components/CharacterList';
import { CharacterCreator } from './components/CharacterCreator';
import { CreateRoomModal } from './components/CreateRoomModal';
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
      setCharacters(data);
    } catch (err) {
      console.error('Failed to load characters', err);
    } finally {
      setIsLoadingChars(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadCharacters();
    }
  }, [user]);

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
            onCancel={() => setCurrentView('characters')}
          />
        )}

        {currentView === 'lobby' && activeRoomCode && (
          <RoomLobby
            roomCode={activeRoomCode}
            onGameStarted={() => setCurrentView('game')}
            onLeave={() => {
              window.history.pushState({}, '', '/');
              setActiveRoomCode('');
              setCurrentView('characters');
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
