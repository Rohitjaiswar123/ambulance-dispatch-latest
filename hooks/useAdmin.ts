'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.email) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Checking admin status for:', user.email);
        
        // Check if user email exists in admins collection
        const adminDocRef = doc(db, 'admins', user.email);
        const adminDoc = await getDoc(adminDocRef);
        
        console.log('📄 Admin document exists:', adminDoc.exists());
        console.log('📄 Admin document data:', adminDoc.data());
        
        if (adminDoc.exists() && adminDoc.data()?.isAdmin === true) {
          setIsAdmin(true);
          console.log('✅ Admin access granted for:', user.email);
        } else {
          setIsAdmin(false);
          console.log('❌ Admin access denied for:', user.email);
          console.log('❌ Document data:', adminDoc.data());
        }
      } catch (error) {
        console.error('❌ Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user]);

  return { isAdmin, loading };
}