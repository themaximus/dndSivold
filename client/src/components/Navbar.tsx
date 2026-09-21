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
    <header className="border-b border-[#242935] bg-[#0c0d11]/95 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-2.5 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={() => setCurrentView('characters')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded bg-[#181c25] border border-[#4a3e26] flex items-center justify-center text-[#c5a059] shadow-sm group-hover:border-[#c5a059] transition-all">
            <Dices className="w-5 h-5 text-[#c5a059]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold font-rpg tracking-wider text-[#e2c26a] group-hover:text-[#f3d98a] transition-colors">
              СиволДнДаево
            </h1>
            <p className="text-[11px] text-[#968e7f] font-serif -mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c5a059]/80"></span>
              AI Dungeon Master
            </p>
          </div>
        </div>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* TTS Voice Toggle */}
          <button
            onClick={toggleSpeech}
            title={isSpeechOn ? "Озвучка мастера включена" : "Озвучка мастера выключена"}
            className={`px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 text-xs font-serif ${
              isSpeechOn
                ? 'bg-[#2b2213] border-[#785e2b] text-[#e2c26a] hover:bg-[#3d301a]'
                : 'bg-[#181c25] border-[#2e3544] text-[#968e7f] hover:text-[#ded7c8]'
            }`}
          >
            {isSpeechOn ? <Volume2 className="w-4 h-4 text-[#c5a059]" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{isSpeechOn ? 'Голос DM' : 'Без звука'}</span>
          </button>

          {user && (
            <>
              <button
                onClick={() => setCurrentView('characters')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-serif font-medium transition-all ${
                  currentView === 'characters'
                    ? 'bg-[#181c25] text-[#e2c26a] border border-[#4a3e26]'
                    : 'text-[#ded7c8] hover:text-[#e2c26a] hover:bg-[#181c25]'
                }`}
              >
                Герои
              </button>

              <button
                onClick={() => setCurrentView('campaigns')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-serif font-medium transition-all flex items-center gap-1.5 ${
                  currentView === 'campaigns'
                    ? 'bg-[#181c25] text-[#e2c26a] border border-[#4a3e26]'
                    : 'text-[#ded7c8] hover:text-[#e2c26a] hover:bg-[#181c25]'
                }`}
              >
                <Compass className="w-4 h-4 text-[#c5a059]" />
                <span className="hidden sm:inline">Мои кампании</span>
              </button>

              <button
                onClick={() => setCurrentView('create-room')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-serif font-medium transition-all flex items-center gap-1.5 ${
                  currentView === 'create-room'
                    ? 'bg-[#181c25] text-[#e2c26a] border border-[#4a3e26]'
                    : 'text-[#ded7c8] hover:text-[#e2c26a] hover:bg-[#181c25]'
                }`}
              >
                <PlusCircle className="w-4 h-4 text-[#c5a059]" />
                <span className="hidden sm:inline">Создать комнату</span>
              </button>

              <div className="h-5 w-px bg-[#242935] mx-1"></div>

              {/* User badge */}
              <div className="flex items-center gap-2 text-[#ded7c8] text-xs sm:text-sm bg-[#13161d] px-2.5 py-1.5 rounded-lg border border-[#2a303d]">
                <User className="w-3.5 h-3.5 text-[#c5a059]" />
                <span className="font-semibold text-[#ded7c8]">{user.username}</span>
                <button
                  onClick={logout}
                  title="Выйти"
                  className="ml-1 text-[#968e7f] hover:text-[#f87171] transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
