import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string, twoFAMethod?: 'email' | 'sms') => Promise<any>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  require2FA: boolean;
  verify2FA: (email: string, code: string) => Promise<void>;
  pending2FAEmail: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [require2FA, setRequire2FA] = useState(false);
  const [pending2FAEmail, setPending2FAEmail] = useState('');

  useEffect(() => {
    setLoading(true);
    authService.getMe()
      .then(res => {
        setUser(res.user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string, twoFAMethod?: 'email' | 'sms') => {
    try {
      setError(null);
      setRequire2FA(false);
      setPending2FAEmail('');
      const response = await authService.login(email, password, twoFAMethod);
      if (response.require2FA) {
        setRequire2FA(true);
        setPending2FAEmail(email);
        return response;
      }
      // Fetch user after login
      const me = await authService.getMe();
      setUser(me.data.user);
      return response;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Login failed';
      setError(errorMessage);
      
      // Check if verification is required and return verification info
      if (err.response?.status === 403 && err.response?.data?.requiresVerification) {
        return {
          requiresVerification: true,
          verificationType: err.response.data.verificationType,
          email: email,
          message: errorMessage
        };
      }
      
      throw err;
    }
  };

  const verify2FA = async (email: string, code: string) => {
    try {
      setError(null);
      await authService.verify2FA(email, code);
      // Fetch user after 2FA
      const me = await authService.getMe();
      setUser(me.data.user);
      setRequire2FA(false);
      setPending2FAEmail('');
    } catch (err: any) {
      setError(err.response?.data?.message || '2FA verification failed');
      throw err;
    }
  };

  const register = async (userData: any) => {
    try {
      setError(null);
      if (userData.password !== userData.confirmPassword) {
        setError('Passwords do not match');
        throw new Error('Passwords do not match');
      }
      const { confirmPassword, ...registrationData } = userData;
      await authService.register(registrationData);
      // Fetch user after register
      const me = await authService.getMe();
      setUser(me.data.user);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Registration failed');
      throw err;
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, require2FA, verify2FA, pending2FAEmail }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 