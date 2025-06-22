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
  login: (email: string, password: string) => Promise<User | null>;
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
          
          // First try to get user document from users collection
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            console.log('✅ User data loaded from users collection:', userData.role);
            setUser({ ...userData, id: firebaseUser.uid });
            setFirebaseUser(firebaseUser);
          } else {
            console.log('❌ No user document found in users collection');
            console.log('🔍 Checking if user is admin...');
            
            // Check if this is an admin user by email
            if (firebaseUser.email) {
              const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.email));
              
              if (adminDoc.exists() && adminDoc.data()?.isAdmin === true) {
                console.log('✅ Admin user found, creating admin user data');
                
                // Create user data for admin with correct role type
                const adminUserData: User = {
                  id: firebaseUser.uid,
                  email: firebaseUser.email,
                  name: 'Admin User',
                  phoneNumber: '',
                  role: 'admin' as const, // Use 'admin' role for admin users
                  createdAt: new Date() as any,
                  updatedAt: new Date() as any,
                };
                
                setUser(adminUserData);
                setFirebaseUser(firebaseUser);
                console.log('✅ Admin user data created successfully');
              } else {
                console.log('❌ User is not an admin either');
                // For non-admin users, use a default role or try to determine from other collections
                const basicUserData: User = {
                  id: firebaseUser.uid,
                  email: firebaseUser.email || '',
                  name: firebaseUser.displayName || 'User',
                  phoneNumber: '',
                  role: 'user' as const, // Use 'user' as default role
                  createdAt: new Date() as any,
                  updatedAt: new Date() as any,
                };
                
                setUser(basicUserData);
                setFirebaseUser(firebaseUser);
                console.log('✅ Basic user data created');
              }
            } else {
              console.error('❌ Firebase user has no email');
              setUser(null);
              setFirebaseUser(null);
            }
          }
        } catch (error) {
          console.error('❌ Error fetching user data:', error);
          
          // Fallback: create basic user data from Firebase Auth
          if (firebaseUser.email) {
            const fallbackUserData: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName || 'User',
              phoneNumber: '',
              role: 'user' as const, // Use 'user' as fallback role
              createdAt: new Date() as any,
              updatedAt: new Date() as any,
            };
            
            setUser(fallbackUserData);
            setFirebaseUser(firebaseUser);
            console.log('✅ Fallback user data created');
          } else {
            setUser(null);
            setFirebaseUser(null);
          }
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

  const login = async (email: string, password: string): Promise<User | null> => {
    try {
      console.log('🔐 Attempting login for:', email);
      await AuthService.loginUser(email, password);
      
      // Wait a moment for the auth state to update
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(user);
        }, 1000);
        
        // If user state updates quickly, resolve immediately
        if (user) {
          clearTimeout(timeout);
          resolve(user);
        }
      });
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
