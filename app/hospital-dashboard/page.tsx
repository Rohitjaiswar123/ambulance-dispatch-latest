'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Header } from '@/components/layout/Header';

import { 
  Building2, 
  Users, 
  Activity, 
  Plus, 
  Minus, 
  Bed, 
  Phone, 
  MapPin, 
  CheckCircle, 
  XCircle, 
  AlertTriangle 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DatabaseService } from '@/services/databaseService';
import { HospitalAdmin, Accident } from '@/types';

export default function HospitalDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hospitalAdmin, setHospitalAdmin] = useState<HospitalAdmin | null>(null);

  const [availableBeds, setAvailableBeds] = useState(25);
  const [totalCapacity] = useState(50);

  const [nearbyEmergencies, setNearbyEmergencies] = useState<Accident[]>([]);
  const [processingEmergencies, setProcessingEmergencies] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.role === 'hospital_admin') {
      loadHospitalData();
    }
  }, [user]);

  const loadHospitalData = async () => {
    try {
      setLoading(true);
      
      const adminData = await DatabaseService.getHospitalAdmin(user!.id);
      setHospitalAdmin(adminData);

      if (adminData?.hospitalLocation) {
        const isValidLocation = await DatabaseService.validateHospitalLocation(adminData.hospitalLocation);
        if (!isValidLocation) {
          toast({
            title: "Location Error",
            description: "Hospital location appears to be invalid. Please contact support.",
            variant: "destructive",
          });
          return;
        }
        
        let searchRadius = 50;
        const emergencies = await DatabaseService.getNearbyPendingAccidents(
          adminData.hospitalLocation,
          searchRadius
        );
        
        setNearbyEmergencies(emergencies);

        if (emergencies.length === 0 && searchRadius === 50) {
          const expandedEmergencies = await DatabaseService.getNearbyPendingAccidents(
            adminData.hospitalLocation,
            100
          );
          
          if (expandedEmergencies.length > 0) {
            setNearbyEmergencies(expandedEmergencies);
            toast({
              title: "Extended Search",
              description: `Found ${expandedEmergencies.length} emergencies within 100km radius.`,
            });
          }
        }
        
      } else {
        toast({
          title: "Setup Required",
          description: "Hospital location not found. Please contact support to update your location.",
          variant: "destructive",
        });
      }
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load hospital data. Please check your internet connection.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptEmergency = async (accident: Accident) => {
    if (!hospitalAdmin) return;
    
    setProcessingEmergencies(prev => new Set(prev).add(accident.id));
    
    try {
      await DatabaseService.createHospitalResponse({
        accidentId: accident.id,
        hospitalId: hospitalAdmin.hospitalId,
        hospitalName: hospitalAdmin.hospitalName,
        status: 'accepted',
        availableBeds: availableBeds,
        estimatedArrivalTime: 15,
        specialtyServices: hospitalAdmin.specialtyServices || [],
      });

      await DatabaseService.notifyAmbulanceDrivers(accident.id, hospitalAdmin.hospitalId);

      toast({
        title: "Emergency Accepted",
        description: `Emergency accepted. Ambulance drivers have been notified.`,
      });

      loadHospitalData();
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to accept emergency",
        variant: "destructive",
      });
    } finally {
      setProcessingEmergencies(prev => {
        const newSet = new Set(prev);
        newSet.delete(accident.id);
        return newSet;
      });
    }
  };

  const handleRejectEmergency = async (accident: Accident) => {
    if (!hospitalAdmin) return;
    
    setProcessingEmergencies(prev => new Set(prev).add(accident.id));
    
    try {
      await DatabaseService.createHospitalResponse({
        accidentId: accident.id,
        hospitalId: hospitalAdmin.hospitalId,
        hospitalName: hospitalAdmin.hospitalName,
        status: 'rejected',
        availableBeds: availableBeds,
        estimatedArrivalTime: 0,
        rejectionReason: 'No available beds or resources',
      });

      toast({
        title: "Emergency Rejected",
        description: "Emergency rejected. Other hospitals can still respond.",
      });

      setNearbyEmergencies(prev => prev.filter(e => e.id !== accident.id));
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject emergency",
        variant: "destructive",
      });
    } finally {
      setProcessingEmergencies(prev => {
        const newSet = new Set(prev);
        newSet.delete(accident.id);
        return newSet;
      });
    }
  };

  const updateBedCount = (change: number) => {
    const newCount = availableBeds + change;
    if (newCount >= 0 && newCount <= totalCapacity) {
      setAvailableBeds(newCount);
      toast({
        title: "Bed Count Updated",
        description: `Available beds: ${newCount}`,
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'hospital_notified': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user || user.role !== 'hospital_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-2">
        <Card className="w-full max-w-md mx-2">
          <CardContent className="p-4 sm:p-6">
            <p className="text-red-600 text-center text-sm sm:text-base">Access denied. Hospital administrators only.</p>
          </CardContent>
        </Card>
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
              <Building2 className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-emerald-600 mr-2 sm:mr-3 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 truncate">Hospital Dashboard</h1>
                <p className="text-xs sm:text-sm lg:text-base text-gray-600 truncate">Welcome back, {user.name}</p>
              </div>
            </div>
            <Button onClick={loadHospitalData} variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
              Refresh
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 sm:py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">Loading hospital data...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* Hospital Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            <Card className="sm:col-span-2 lg:col-span-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Hospital Name</CardTitle>
                  <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm sm:text-lg lg:text-xl font-bold break-words leading-tight">
                    {hospitalAdmin?.hospitalName || 'Loading...'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Hospital Address</CardTitle>
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="text-xs sm:text-sm lg:text-base font-bold break-words leading-tight">
                    {hospitalAdmin?.hospitalAddress || 'Loading...'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium">Contact Number</CardTitle>
                  <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm sm:text-lg lg:text-xl font-bold">
                    {hospitalAdmin?.hospitalPhoneNumber || 'Loading...'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bed Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-sm sm:text-base lg:text-lg">
                  <Bed className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                  Bed Management
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Manage available beds and capacity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                    <div>
                      <p className="text-xs font-medium text-gray-700">Available Beds</p>
                      <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">{availableBeds}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-700">Total Capacity</p>
                      <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-600">{totalCapacity}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-700">Occupancy Rate</p>
                      <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-600">
                        {Math.round(((totalCapacity - availableBeds) / totalCapacity) * 100)}%
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center space-x-3 sm:space-x-4">
                    <Button 
                      onClick={() => updateBedCount(-1)}
                      variant="outline"
                      size="sm"
                      disabled={availableBeds <= 0}
                      className="flex-1 max-w-28 text-xs sm:text-sm"
                    >
                      <Minus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span className="hidden sm:inline">Decrease</span>
                      <span className="sm:hidden">-</span>
                    </Button>
                    <Button 
                      onClick={() => updateBedCount(1)}
                      variant="outline"
                      size="sm"
                      disabled={availableBeds >= totalCapacity}
                      className="flex-1 max-w-28 text-xs sm:text-sm"
                    >
                      <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span className="hidden sm:inline">Increase</span>
                      <span className="sm:hidden">+</span>
                    </Button>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3">
                    <div 
                      className="bg-green-600 h-2 sm:h-3 rounded-full transition-all duration-300"
                      style={{ width: `${(availableBeds / totalCapacity) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-600 text-center">
                    {availableBeds} beds available out of {totalCapacity} total capacity
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Nearby Emergency Cases */}
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:gap-2 text-sm sm:text-base lg:text-lg">
                  <div className="flex items-center">
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 flex-shrink-0" />
                    Nearby Emergency Cases
                  </div>
                  <Badge variant="secondary" className="self-start text-xs">
                    {nearbyEmergencies.length} pending
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Emergency cases within 50km that need hospital response
                </CardDescription>
              </CardHeader>
              <CardContent>
                {nearbyEmergencies.length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <AlertTriangle className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
                    <p className="text-gray-500 mb-2 text-sm sm:text-base">No nearby emergency cases</p>
                    <p className="text-xs sm:text-sm text-gray-400">Emergency cases will appear here when reported nearby</p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {nearbyEmergencies.map((accident) => (
                      <div key={accident.id} className="border rounded-lg p-3 bg-white">
                        <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-start sm:justify-between mb-3">
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                            <Badge className={`${getSeverityColor(accident.severity)} text-xs`}>
                              {accident.severity.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className={`${getStatusColor(accident.status)} text-xs`}>
                              {accident.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                          <span className="text-xs text-gray-500 self-start">
                            {accident.timestamp?.toDate?.()?.toLocaleString() || 'N/A'}
                          </span>
                        </div>
                        
                        <div className="mb-3">
                          <h4 className="font-medium text-gray-900 mb-2 text-sm">Emergency #{accident.id.slice(-6)}</h4>
                          <p className="text-xs sm:text-sm text-gray-700 mb-2 break-words leading-relaxed">{accident.description}</p>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs text-gray-600 mb-2">
                            <div className="flex items-center">
                              <Users className="h-3 w-3 mr-1 flex-shrink-0" />
                              <span className="truncate">Injured: {accident.injuredCount}</span>
                            </div>
                            <div className="flex items-center">
                              <Activity className="h-3 w-3 mr-1 flex-shrink-0" />
                              <span className="truncate">Vehicles: {accident.vehiclesInvolved}</span>
                            </div>
                            <div className="flex items-center">
                              <Phone className="h-3 w-3 mr-1 flex-shrink-0" />
                              <span className="truncate">{accident.contactNumber}</span>
                            </div>
                            <div className="flex items-center">
                              <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                              <span className="truncate">
                                {hospitalAdmin?.hospitalLocation ? 
                                  `${DatabaseService.calculateDistance(
                                    hospitalAdmin.hospitalLocation.latitude,
                                    hospitalAdmin.hospitalLocation.longitude,
                                    accident.location.latitude,
                                    accident.location.longitude
                                  ).toFixed(1)} km away` : 'Distance unknown'
                                }
                              </span>
                            </div>
                          </div>
                          
                          {accident.additionalInfo && (
                            <div className="bg-gray-50 p-2 rounded text-xs text-gray-600 mb-2">
                              <strong>Additional Info:</strong> <span className="break-words">{accident.additionalInfo}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          <Button
                            onClick={() => handleAcceptEmergency(accident)}
                            disabled={processingEmergencies.has(accident.id) || availableBeds <= 0}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs"
                            size="sm"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">Accept Emergency</span>
                            <span className="sm:hidden">Accept</span>
                          </Button>
                          
                          <Button
                            onClick={() => handleRejectEmergency(accident)}
                            disabled={processingEmergencies.has(accident.id)}
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50 text-xs"
                            size="sm"
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">Cannot Accept</span>
                            <span className="sm:hidden">Reject</span>
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`https://maps.google.com/?q=${accident.location.latitude},${accident.location.longitude}`, '_blank')}
                            className="text-xs"
                          >
                            <MapPin className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">View Location</span>
                            <span className="sm:hidden">Location</span>
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`tel:${accident.contactNumber}`, '_blank')}
                            className="text-xs"
                          >
                            <Phone className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">Call Reporter</span>
                            <span className="sm:hidden">Call</span>
                          </Button>
                        </div>
                        
                        {/* Bed availability warning */}
                        {availableBeds <= 0 && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                            ⚠️ No available beds - Cannot accept new emergencies
                          </div>
                        )}
                        
                        {availableBeds <= 5 && availableBeds > 0 && (
                          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                            ⚠️ Low bed availability - Only {availableBeds} beds remaining
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Hospital Statistics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Today's Admissions</CardTitle>
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">+2 from yesterday</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Nearby Emergencies</CardTitle>
                  <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold">{nearbyEmergencies.length}</div>
                  <p className="text-xs text-muted-foreground">Pending response</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Staff on Duty</CardTitle>
                  <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold">24</div>
                  <p className="text-xs text-muted-foreground">Doctors & Nurses</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">Bed Utilization</CardTitle>
                  <Bed className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold">
                    {Math.round(((totalCapacity - availableBeds) / totalCapacity) * 100)}%
                  </div>
                  <p className="text-xs text-muted-foreground">Current occupancy</p>
                </CardContent>
              </Card>
            </div>

            {/* Emergency Response Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-sm sm:text-base lg:text-lg">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600 flex-shrink-0" />
                  Emergency Response Instructions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-gray-700">
                  <div className="flex items-start space-x-2">
                    <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                    <p><strong>Monitor Emergencies:</strong> Nearby emergency cases appear automatically based on your hospital location</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                    <p><strong>Check Capacity:</strong> Ensure you have available beds before accepting emergencies</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                    <p><strong>Accept/Reject:</strong> Accept emergencies you can handle, reject if no capacity</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                    <p><strong>Ambulance Dispatch:</strong> Accepting an emergency automatically notifies ambulance drivers</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
                    <p><strong>Prepare Resources:</strong> Get your emergency team ready for incoming patients</p>
                  </div>
                </div>
                
                <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-800">
                    <strong>✅ Best Practice:</strong> Keep your bed count updated in real-time to ensure accurate emergency response capacity.
                  </p>
                </div>

                <div className="mt-2 sm:mt-3 p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-800">
                    <strong>🚨 Critical:</strong> Only accept emergencies you can properly handle. Patient safety is the top priority.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

