'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { AuthService } from '@/services/authService';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (userData: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔄 Auth state changed:', firebaseUser?.uid || 'No user');
      
      if (firebaseUser) {
        try {
          console.log('📋 Fetching user data for:', firebaseUser.uid);
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            console.log('✅ User data loaded:', userData.role);
            setUser({ ...userData, id: firebaseUser.uid });
            setFirebaseUser(firebaseUser);
          } else {
            console.error('❌ No user document found in Firestore');
            setUser(null);
            setFirebaseUser(null);
          }
        } catch (error) {
          console.error('❌ Error fetching user data:', error);
          setUser(null);
          setFirebaseUser(null);
        }
      } else {
        console.log('🚪 No Firebase user - clearing state');
        setUser(null);
        setFirebaseUser(null);
      }
      
      setLoading(false);
      setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      console.log('🔐 Attempting login for:', email);
      await AuthService.loginUser(email, password);
      // Don't set loading to false here - let onAuthStateChanged handle it
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 Logging out user');
      await AuthService.logoutUser();
      // State will be cleared by onAuthStateChanged
    } catch (error) {
      console.error('❌ Logout error:', error);
      throw error;
    }
  };

  const register = async (userData: any) => {
    try {
      console.log('📝 Registering user:', userData.email);
      await AuthService.registerUser(userData);
      // Don't redirect here - let the calling component handle it
    } catch (error) {
      console.error('❌ Registration error:', error);
      throw error;
    }
  };

  const value = {
    user,
    firebaseUser,
    loading: loading || initializing,
    login,
    logout,
    register,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
