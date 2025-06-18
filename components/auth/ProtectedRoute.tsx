'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  allowedRoles = [], 
  redirectTo = '/login' 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Don't do anything while still loading
    if (loading) {
      setShouldRender(false);
      return;
    }

    // If no user and not loading, redirect to login
    if (!user) {
      console.log('🚪 No user found, redirecting to login');
      router.push(redirectTo);
      setShouldRender(false);
      return;
    }

    // If user exists but role not allowed, redirect to unauthorized
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      console.log('🚫 User role not allowed:', user.role, 'Allowed:', allowedRoles);
      router.push('/unauthorized');
      setShouldRender(false);
      return;
    }

    // User is authenticated and authorized
    console.log('✅ User authorized:', user.role);
    setShouldRender(true);
  }, [user, loading, router, allowedRoles, redirectTo]);

  // Show loading while checking auth or during redirects
  if (loading || !shouldRender) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {loading ? 'Loading...' : 'Checking permissions...'}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}