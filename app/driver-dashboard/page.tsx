'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';
import { Truck, MapPin, Clock, Phone, AlertTriangle, Plus, Trash2, Zap, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DatabaseService } from '@/services/databaseService';
import { Accident } from '@/types';
import { EmergencyModal } from '@/components/emergency/EmergencyModal';
import { useEmergencyAlert } from '@/hooks/useEmergencyAlert';
import { LiveNotifications } from '@/components/notifications/LiveNotifications';
import { AccidentIoTContext } from '@/components/iot/AccidentIoTContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function DriverDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [accidents, setAccidents] = useState<Accident[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [deletingAccidents, setDeletingAccidents] = useState<Set<string>>(new Set());
  
  const { state: emergencyState, reportEmergency, clearEmergencyState } = useEmergencyAlert();

  useEffect(() => {
    if (!user || user.role !== 'vehicle_driver') {
      router.push('/login');
      return;
    }
    loadData();
    
    // Set up auto-refresh for IoT accidents
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [user, router]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading accidents for user:', user?.id);
      
      if (!user?.id) {
        console.error('❌ No user ID available');
        return;
      }

      const userAccidents = await DatabaseService.getAccidentsByReporter(user.id);
      setAccidents(userAccidents);
      
      console.log(`✅ Loaded ${userAccidents.length} accidents for driver dashboard`);
      
      // Show toast for new IoT accidents
      const iotAccidents = userAccidents.filter(acc => 
        acc.additionalInfo?.includes('AUTO-GENERATED from IoT') && 
        acc.status === 'pending'
      );
      
      if (iotAccidents.length > 0) {
        toast({
          title: "🤖 IoT Emergency Detected",
          description: `${iotAccidents.length} automatic emergency report(s) generated from your IoT device`,
          duration: 5000,
        });
      }
      
    } catch (error) {
      console.error('Error loading accidents:', error);
      toast({
        title: "Error",
        description: "Failed to load your accident reports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyReport = async (emergencyData: {
    location: { latitude: number; longitude: number };
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    injuredCount: number;
    vehiclesInvolved: number;
    additionalInfo?: string;
    contactNumber: string;
  }) => {
    try {
      await reportEmergency(emergencyData);
      setShowEmergencyModal(false);
      loadData(); // Refresh the accidents list
    } catch (error) {
      console.error('Error reporting emergency:', error);
    }
  };

  const handleDeleteAccident = async (accidentId: string) => {
    if (!confirm('Are you sure you want to delete this accident report? This action cannot be undone.')) {
      return;
    }

    setDeletingAccidents(prev => new Set(prev).add(accidentId));
    
    try {
      await DatabaseService.deleteAccident(accidentId);
      
      toast({
        title: "Accident Deleted",
        description: "The accident report has been successfully deleted.",
      });
      
      // Remove from local state
      setAccidents(prev => prev.filter(acc => acc.id !== accidentId));
      
    } catch (error: any) {
      console.error('Error deleting accident:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete accident report",
        variant: "destructive",
      });
    } finally {
      setDeletingAccidents(prev => {
        const newSet = new Set(prev);
        newSet.delete(accidentId);
        return newSet;
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'assigned': return 'bg-purple-500';
      case 'hospital_accepted': return 'bg-indigo-500';
      case 'hospital_notified': return 'bg-orange-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const canDeleteAccident = (accident: Accident) => {
    return accident.status === 'pending' || accident.status === 'hospital_notified';
  };

  const isIoTGenerated = (accident: Accident) => {
    return accident.additionalInfo?.includes('AUTO-GENERATED from IoT');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 sm:py-6 lg:py-8">
        {/* Welcome Section */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center min-w-0">
              <Truck className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-blue-600 mr-2 sm:mr-3 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">Driver Dashboard</h1>
                <p className="text-xs sm:text-sm lg:text-base text-gray-600 truncate">Welcome back, {user.name}</p>
                <p className="text-xs text-gray-500">Email: {user.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <LiveNotifications />
              <Button onClick={loadData} variant="outline" size="sm" className="text-xs sm:text-sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* IoT Device Status */}
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Zap className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>
                <strong>🤖 IoT Emergency Detection:</strong> Your device is monitored 24/7. 
                Emergency reports will automatically appear here when critical conditions are detected.
              </span>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Device: Active
              </Badge>
            </div>
          </AlertDescription>
        </Alert>

        {/* Emergency Alert Button */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center min-w-0">
                  <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-red-600 mr-2 sm:mr-3 lg:mr-4 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-red-900">Emergency Reporting</h3>
                    <p className="text-xs sm:text-sm lg:text-base text-red-700">Report accidents and emergencies immediately</p>
                  </div>
                </div>
                <Button 
                  onClick={() => setShowEmergencyModal(true)}
                  className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto text-xs sm:text-sm"
                  size="lg"
                  disabled={emergencyState.isReporting}
                >
                  {emergencyState.isReporting ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-white mr-2"></div>
                      Reporting...
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 mr-2" />
                      <span className="hidden sm:inline">Report Emergency</span>
                      <span className="sm:hidden">Emergency</span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Emergency Alert */}
        {emergencyState.isEmergencyActive && emergencyState.accidentId && (
          <div className="mb-4 sm:mb-6 lg:mb-8">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center min-w-0">
                    <div className="animate-pulse bg-green-500 rounded-full h-2 w-2 sm:h-3 sm:w-3 mr-2 sm:mr-3 flex-shrink-0"></div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-green-900">Emergency Active</h3>
                      <p className="text-xs sm:text-sm lg:text-base text-green-700">Your emergency has been reported. Help is on the way!</p>
                      <p className="text-xs text-green-600 break-all">Emergency ID: {emergencyState.accidentId.slice(-6)}</p>
                    </div>
                  </div>
                  <Button 
                    onClick={clearEmergencyState}
                    variant="outline"
                    className="border-green-300 text-green-700 hover:bg-green-100 w-full sm:w-auto text-xs sm:text-sm"
                  >
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Accident Reports */}
        <div>
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
              Your Accident Reports ({accidents.length})
            </h2>
            <div className="flex gap-2">
              <Badge variant="outline">
                Manual: {accidents.filter(a => !isIoTGenerated(a)).length}
              </Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                IoT Generated: {accidents.filter(a => isIoTGenerated(a)).length}
              </Badge>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 sm:py-12">
              <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary"></div>
            </div>
          ) : accidents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-6 sm:py-8 lg:py-12">
                <AlertTriangle className="h-8 w-8 sm:h-12 sm:w-12 text-
gray-400 mx-auto mb-3 sm:mb-4" />
                <h3 className="text-sm sm:text-base lg:text-lg font-medium text-gray-900 mb-2">No Accident Reports</h3>
                <p className="text-xs sm:text-sm lg:text-base text-gray-500 mb-3 sm:mb-4 lg:mb-6">You haven't reported any accidents yet.</p>
                <Button 
                  onClick={() => setShowEmergencyModal(true)}
                  className="bg-red-600 hover:bg-red-700 w-full sm:w-auto text-xs sm:text-sm"
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  Report Your First Emergency
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:gap-4 lg:gap-6">
              {accidents.map((accident) => (
                <div key={accident.id} className="space-y-4">
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2 sm:pb-3">
                      <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:justify-between sm:items-start">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-sm sm:text-base lg:text-lg flex items-center gap-2">
                            Accident Report #{accident.id.slice(-6)}
                            {isIoTGenerated(accident) && (
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                🤖 IoT Auto-Generated
                              </Badge>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-1 text-xs sm:text-sm">
                            {new Date(accident.timestamp.seconds * 1000).toLocaleString()}
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 self-start">
                          <Badge className={`${getSeverityColor(accident.severity)} text-xs`}>
                            {accident.severity.toUpperCase()}
                          </Badge>
                          <Badge className={`${getStatusColor(accident.status)} text-xs`}>
                            {accident.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3 sm:space-y-4">
                        <p className="text-xs sm:text-sm lg:text-base text-gray-700 break-words leading-relaxed">{accident.description}</p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 text-xs sm:text-sm">
                          <div className="flex items-center">
                            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 mr-1 sm:mr-2 flex-shrink-0" />
                            <span className="truncate">Location: {accident.location.latitude.toFixed(4)}, {accident.location.longitude.toFixed(4)}</span>
                          </div>
                          <div className="flex items-center">
                            <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 mr-1 sm:mr-2 flex-shrink-0" />
                            <span className="truncate">{accident.contactNumber}</span>
                          </div>
                          <div className="truncate">Injured: {accident.injuredCount}</div>
                          <div className="truncate">Vehicles: {accident.vehiclesInvolved}</div>
                        </div>

                        {accident.additionalInfo && (
                          <div className="bg-gray-50 p-2 sm:p-3 rounded-lg">
                            <p className="text-xs sm:text-sm text-gray-600 break-words">
                              <strong>Additional Info:</strong> {accident.additionalInfo}
                            </p>
                          </div>
                        )}

                        <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center pt-3 sm:pt-4 border-t">
                          <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`https://maps.google.com/?q=${accident.location.latitude},${accident.location.longitude}`, '_blank')}
                              className="w-full sm:w-auto text-xs"
                            >
                              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                              <span className="hidden sm:inline">View Location</span>
                              <span className="sm:hidden">Location</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`tel:${accident.contactNumber}`, '_blank')}
                              className="w-full sm:w-auto text-xs"
                            >
                              <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                              Call
                            </Button>
                          </div>
                          
                          {canDeleteAccident(accident) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteAccident(accident.id)}
                              disabled={deletingAccidents.has(accident.id)}
                              className="border-red-300 text-red-600 hover:bg-red-50 w-full sm:w-auto text-xs mt-2 sm:mt-0"
                            >
                              {deletingAccidents.has(accident.id) ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-red-600 mr-1 sm:mr-2"></div>
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                  Delete
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* IoT Context - Only show for IoT-generated accidents */}
                  {isIoTGenerated(accident) && (
                    <AccidentIoTContext accident={accident} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Emergency Modal */}
      <EmergencyModal
        isOpen={showEmergencyModal}
        onClose={() => setShowEmergencyModal(false)}
        onSubmit={handleEmergencyReport}
      />
    </div>
  );
}
