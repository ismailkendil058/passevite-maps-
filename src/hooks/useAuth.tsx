import { useState, useEffect, createContext, useContext, ReactNode, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AuthUser {
  id: string;
  username: string;
  role: string;
}

interface AuthContextType {
  user: any;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: Error | null; data: any }>;
  signOut: () => Promise<void>;
  userRole: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    // Check localStorage for a manual session
    const savedUser = localStorage.getItem('passevite_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setUserRole(parsed.role);
      } catch (e) {
        console.error("Failed to parse saved user", e);
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      // Query our custom 'roles' table
      const { data, error } = await (supabase as any)
        .from('roles')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        return { error: new Error('Identifiants incorrects'), data: null };
      }

      const mockUser = {
        id: data.id,
        email: `${data.username}@gmail.com`,
        username: data.username,
        role: data.role
      };

      localStorage.setItem('passevite_user', JSON.stringify(mockUser));
      setUser(mockUser);
      setUserRole(data.role);

      return { error: null, data: { user: mockUser } };
    } catch (e) {
      return { error: e as Error, data: null };
    }
  };

  const signOut = async () => {
    localStorage.removeItem('passevite_user');
    localStorage.removeItem('doctor_auth');
    setUser(null);
    setUserRole(null);
  };

  const contextValue = useMemo(() => ({
    user,
    loading,
    signIn,
    signOut,
    userRole
  }), [user, loading, userRole]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
