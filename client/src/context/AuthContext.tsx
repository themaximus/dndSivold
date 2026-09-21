import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api, getAuthToken, setAuthToken } from '../services/api';
import { disconnectSocket } from '../services/socket';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, pass: string) => Promise<void>;
  register: (username: string, pass: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = getAuthToken();
      const savedUserStr = localStorage.getItem('dnd_user_profile');
      let cachedUser: User | null = null;
      if (savedUserStr) {
        try {
          cachedUser = JSON.parse(savedUserStr);
        } catch (e) {
          // ignore
        }
      }

      if (!token) {
        if (cachedUser && cachedUser.username) {
          try {
            const res = await api.restoreSession(cachedUser.username, cachedUser.id);
            setUser(res.user);
            localStorage.setItem('dnd_user_profile', JSON.stringify(res.user));
            setLoading(false);
            return;
          } catch (e) {
            console.warn('Auto-restore without token failed:', e);
          }
        }
        setLoading(false);
        return;
      }

      try {
        const { user } = await api.getMe();
        setUser(user);
        localStorage.setItem('dnd_user_profile', JSON.stringify(user));
      } catch (err) {
        console.warn('Token check failed, attempting auto-restore session across server deployment...', err);
        if (cachedUser && cachedUser.username) {
          try {
            const res = await api.restoreSession(cachedUser.username, cachedUser.id);
            setUser(res.user);
            localStorage.setItem('dnd_user_profile', JSON.stringify(res.user));
          } catch (restoreErr) {
            console.error('Session auto-restore failed:', restoreErr);
            setAuthToken(null);
          }
        } else {
          setAuthToken(null);
        }
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (username: string, pass: string) => {
    const res = await api.login(username, pass);
    setUser(res.user);
    localStorage.setItem('dnd_user_profile', JSON.stringify(res.user));
  };

  const register = async (username: string, pass: string) => {
    const res = await api.register(username, pass);
    setUser(res.user);
    localStorage.setItem('dnd_user_profile', JSON.stringify(res.user));
  };

  const logout = () => {
    localStorage.removeItem('dnd_user_profile');
    localStorage.removeItem('dnd_characters_cache');
    setAuthToken(null);
    setUser(null);
    disconnectSocket();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
