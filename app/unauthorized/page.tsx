'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';
import { Shield, Home, LogOut, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully.",
      });
      router.push('/');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getDashboardPath = () => {
    if (!user) return '/';
    
    switch (user.role) {
      case 'vehicle_driver':
        return '/driver-dashboard';
      case 'ambulance_driver':
        return '/ambulance-dashboard';
      case 'hospital_admin':
        return '/hospital-dashboard';
      default:
        return '/';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <Shield className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-red-600">Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access this page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 text-center">
                This page is restricted to specific user roles. Please contact your administrator 
                if you believe you should have access to this resource.
              </p>
            </div>

            {user && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 text-center">
                  <strong>Current Role:</strong> {user.role.replace('_', ' ').toUpperCase()}
                </p>
                <p className="text-sm text-blue-700 text-center mt-1">
                  Logged in as: {user.name}
                </p>
              </div>
            )}
            
            <div className="flex flex-col space-y-2">
              <Button 
                onClick={() => router.back()}
                variant="outline"
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
              
              {user ? (
                <>
                  <Link href={getDashboardPath()} className="block">
                    <Button className="w-full">
                      <Home className="h-4 w-4 mr-2" />
                      Go to Dashboard
                    </Button>
                  </Link>
                  
                  <Button 
                    onClick={handleLogout}
                    variant="outline"
                    className="w-full border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout & Sign In as Different User
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/" className="block">
                    <Button className="w-full">
                      <Home className="h-4 w-4 mr-2" />
                      Go to Home
                    </Button>
                  </Link>
                  
                  <Link href="/login" className="block">
                    <Button variant="outline" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Help Section */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Need Help?</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• Vehicle drivers can access the driver dashboard</p>
                <p>• Ambulance drivers can access the ambulance dashboard</p>
                <p>• Hospital admins can access the hospital dashboard</p>
                <p>• Contact support if you need role changes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}