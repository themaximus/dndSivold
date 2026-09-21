import React from 'react';
import { useAuth } from '../context/AuthContext';
import { soundFx } from '../utils/audio';
import { Shield, Volume2, VolumeX, User, LogOut, PlusCircle, Dices, Compass } from 'lucide-react';

interface NavbarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, setCurrentView }) => {
  const { user, logout } = useAuth();
  const [isSpeechOn, setIsSpeechOn] = React.useState(soundFx.getSpeechState());

  const toggleSpeech = () => {
    const newState = soundFx.toggleSpeech();
    setIsSpeechOn(newState);
  };

  return (
    <header className="border-b border-fantasy-border bg-fantasy-panel/90 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-3">
      <div className="max-w-[1920px] mx-auto flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={() => setCurrentView('characters')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-glow-gold group-hover:scale-105 transition-transform">
            <Dices className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-rpg tracking-wider text-amber-400 group-hover:text-amber-300 transition-colors">
              СиволДнДаево
            </h1>
            <p className="text-xs text-slate-400 -mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              AI Dungeon Master
            </p>
          </div>
        </div>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-4">
          {/* TTS Voice Toggle */}
          <button
            onClick={toggleSpeech}
            title={isSpeechOn ? "Озвучка мастера включена" : "Озвучка мастера выключена"}
            className={`p-2 rounded-lg border transition-all flex items-center gap-1.5 text-xs font-medium ${
              isSpeechOn
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isSpeechOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{isSpeechOn ? 'Голос DM' : 'Без звука'}</span>
          </button>

          {user && (
            <>
              <button
                onClick={() => setCurrentView('characters')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  currentView === 'characters'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                Герои
              </button>

              <button
                onClick={() => setCurrentView('campaigns')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  currentView === 'campaigns'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Compass className="w-4 h-4" />
                Мои кампании
              </button>

              <button
                onClick={() => setCurrentView('create-room')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  currentView === 'create-room'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                Создать комнату
              </button>

              <div className="h-6 w-px bg-fantasy-border"></div>

              {/* User badge */}
              <div className="flex items-center gap-2 text-slate-300 text-sm bg-fantasy-card px-3 py-1.5 rounded-lg border border-fantasy-border">
                <User className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-slate-100">{user.username}</span>
                <button
                  onClick={logout}
                  title="Выйти"
                  className="ml-2 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
