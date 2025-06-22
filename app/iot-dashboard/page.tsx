'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { IoTDashboard } from '@/components/iot/IoTDashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { LogOut } from 'lucide-react';

export default function IoTDashboardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Success",
        description: "Logged out successfully",
      });
      router.push('/');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  // Show loading state while checking authentication and admin status
  if (authLoading || adminLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Verifying access permissions...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Check if user is authenticated
  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-700">🔒 Authentication Required</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertDescription>
                  You must be logged in to access the IoT Dashboard.
                </AlertDescription>
              </Alert>
              <div className="mt-4 space-x-2">
                <Button onClick={() => router.push('/login')}>
                  Login
                </Button>
                <Button variant="outline" onClick={() => router.push('/')}>
                  Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Check if user is admin
  if (!isAdmin) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-700">⚠️ Admin Access Required</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <p>
                      <strong>Access Denied:</strong> The IoT Dashboard requires administrator privileges.
                    </p>
                    <p className="text-sm text-gray-600">
                      Current user: {user.email}
                    </p>
                    <p className="text-sm text-gray-600">
                      If you believe you should have admin access, please contact the system administrator.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
              <div className="mt-4 space-x-2">
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                  Go to Dashboard
                </Button>
                <Button variant="outline" onClick={() => router.push('/')}>
                  Go Home
                </Button>
                <Button variant="outline" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // User is authenticated and is admin - show the IoT dashboard
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                🚑 Rakshak IoT Dashboard
              </h1>
              <p className="text-gray-600">
                Real-time monitoring of ESP32 sensor data with automatic emergency detection
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">
                Admin: {user.email}
              </div>
              <div className="text-xs text-green-600">
                ✅ Admin Access Verified
              </div>
              <div className="mt-2">
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Admin-only notice */}
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <AlertDescription>
            <div className="flex items-center gap-2">
              <span className="text-blue-600">🔒</span>
              <span className="text-blue-800">
                <strong>Admin Dashboard:</strong> This page is restricted to administrators only. 
                You have full access to IoT monitoring and emergency detection systems.
              </span>
            </div>
          </AlertDescription>
        </Alert>
        
        <IoTDashboard showEmergencyControls={true} />
      </div>
    </div>
  );
}
