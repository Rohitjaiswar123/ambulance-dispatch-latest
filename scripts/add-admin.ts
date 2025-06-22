// Create this file to add admins programmatically
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export async function addAdmin(email: string, name: string) {
  try {
    await setDoc(doc(db, 'admins', email), {
      email,
      isAdmin: true,
      name,
      createdAt: new Date().toISOString()
    });
    console.log('✅ Admin added:', email);
  } catch (error) {
    console.error('❌ Error adding admin:', error);
  }
}

// Usage: addAdmin('newadmin@domain.com', 'New Admin');