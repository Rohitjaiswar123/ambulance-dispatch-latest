'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Heart, LogOut, User, Menu, Activity } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
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

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'vehicle_driver':
        return 'Vehicle Driver';
      case 'ambulance_driver':
        return 'Ambulance Driver';
      case 'hospital_admin':
        return 'Hospital Admin';
      default:
        return 'User';
    }
  };

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between py-3 sm:py-4">
          {/* Logo and Brand */}
          <Link href={user ? getDashboardPath() : '/'} className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <div className="bg-red-600 p-1.5 sm:p-2 rounded-xl flex-shrink-0">
              <Heart className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white" />
            </div>
            <span className="text-sm sm:text-lg lg:text-xl font-bold text-slate-900 truncate">
              <span className="hidden xs:inline">Emergency Dispatch</span>
              <span className="xs:hidden">Emergency</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-3 lg:space-x-4">
            {user ? (
              <>
                {/* User Info */}
                <div className="flex items-center space-x-2 text-xs lg:text-sm">
                  <User className="h-3 w-3 lg:h-4 lg:w-4 text-gray-500 flex-shrink-0" />
                  <div className="text-right min-w-0">
                    <p className="font-medium text-gray-900 truncate">{user.name}</p>
                    <p className="text-gray-500 truncate">{getRoleDisplayName(user.role)}</p>
                  </div>
                </div>

                {/* IoT Dashboard Link - NEW */}
                <Link href="/iot-dashboard">
                  <Button variant="outline" size="sm" className="text-xs lg:text-sm">
                    <Activity className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
                    <span className="hidden lg:inline">IoT Monitor</span>
                    <span className="lg:hidden">IoT</span>
                  </Button>
                </Link>

                {/* Dashboard Link */}
                <Link href={getDashboardPath()}>
                  <Button variant="outline" size="sm" className="text-xs lg:text-sm">
                    Dashboard
                  </Button>
                </Link>

                {/* Logout Button */}
                <Button onClick={handleLogout} variant="outline" size="sm" className="text-xs lg:text-sm">
                  <LogOut className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
                  <span className="hidden lg:inline">Logout</span>
                  <span className="lg:hidden">Out</span>
                </Button>
              </>
            ) : (
              <>
                {/* Login/Register Links for non-authenticated users */}
                <Link href="/login">
                  <Button variant="outline" size="sm" className="text-xs lg:text-sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-red-600 hover:bg-red-700 text-xs lg:text-sm">
                    Register
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 py-3 space-y-3">
            {user ? (
              <>
                {/* User Info */}
                <div className="flex items-center space-x-2 px-2">
                  <User className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm truncate">{user.name}</p>
                    <p className="text-gray-500 text-xs truncate">{getRoleDisplayName(user.role)}</p>
                  </div>
                </div>

                {/* Mobile Navigation Links */}
                <div className="space-y-2 px-2">
                  {/* IoT Dashboard Link - NEW */}
                  <Link href="/iot-dashboard" className="block">
                    <Button variant="outline" size="sm" className="w-full justify-start text-sm">
                      <Activity className="h-4 w-4 mr-2" />
                      IoT Dashboard
                    </Button>
                  </Link>
                  
                  <Link href={getDashboardPath()} className="block">
                    <Button variant="outline" size="sm" className="w-full justify-start text-sm">
                      Dashboard
                    </Button>
                  </Link>
                  <Button 
                    onClick={handleLogout} 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start text-sm"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-2 px-2">
                <Link href="/login" className="block">
                  <Button variant="outline" size="sm" className="w-full justify-start text-sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register" className="block">
                  <Button size="sm" className="bg-red-600 hover:bg-red-700 w-full justify-start text-sm">
                    Register
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
