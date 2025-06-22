'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAssignmentTracking } from '@/hooks/useAssignmentTracking';
import { MapPin, Navigation, Clock, Phone, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AssignmentTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const assignmentId = params.id as string;

  const {
    assignment,
    accident,
    hospital,
    currentLocation,
    destination,
    distance,
    eta,
    loading,
    error,
    updateAssignmentStatus,
    getDirectionsUrl,
    refreshData
  } = useAssignmentTracking({
    assignmentId,
    onLocationUpdate: (location) => {
      console.log('Location updated:', location);
    },
    onStatusChange: (status) => {
      toast({
        title: "Status Updated",
        description: `Assignment status changed to ${status.replace('_', ' ')}`,
      });
    }
  });

  // Calculate phase based on assignment status and location
  const [phase, setPhase] = useState<'going_to_scene' | 'at_scene' | 'going_to_hospital' | 'completed'>('going_to_scene');
  const [isNearDestination, setIsNearDestination] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'ambulance_driver') {
      router.push('/login');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (assignment && accident && hospital) {
      // Determine current phase based on status and location
      if (assignment.status === 'completed') {
        setPhase('completed');
      } else if (assignment.status === 'in_progress') {
        // Could be at scene or going to hospital
        // This is simplified logic - you might want more sophisticated detection
        setPhase('at_scene');
      } else {
        setPhase('going_to_scene');
      }
    }
  }, [assignment?.status, accident, hospital]);

  useEffect(() => {
    if (distance !== null) {
      setIsNearDestination(distance < 0.1); // Within 100 meters
    }
  }, [distance]);

  const handleStatusUpdate = async (newStatus: 'in_progress' | 'completed') => {
    try {
      await updateAssignmentStatus(newStatus);
      toast({
        title: "Status Updated",
        description: `Assignment marked as ${newStatus.replace('_', ' ')}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update assignment status",
        variant: "destructive",
      });
    }
  };

  const getPhaseInfo = () => {
    switch (phase) {
      case 'going_to_scene':
        return {
          title: 'En Route to Accident Scene',
          description: 'Navigate to the accident location',
          color: 'bg-blue-500',
          icon: <Navigation className="h-4 w-4" />
        };
      case 'at_scene':
        return {
          title: 'At Accident Scene',
          description: 'Providing emergency care',
          color: 'bg-orange-500',
          icon: <AlertTriangle className="h-4 w-4" />
        };
      case 'going_to_hospital':
        return {
          title: 'En Route to Hospital',
          description: 'Transporting patient to hospital',
          color: 'bg-purple-500',
          icon: <Navigation className="h-4 w-4" />
        };
      case 'completed':
        return {
          title: 'Assignment Completed',
          description: 'Patient delivered to hospital',
          color: 'bg-green-500',
          icon: <CheckCircle className="h-4 w-4" />
        };
      default:
        return {
          title: 'Assignment Active',
          description: 'Emergency response in progress',
          color: 'bg-gray-500',
          icon: <Clock className="h-4 w-4" />
        };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'accepted': return 'bg-orange-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading assignment details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!assignment || !accident || !hospital) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Assignment data not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const phaseInfo = getPhaseInfo();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Live Assignment Tracking</h1>
            <p className="text-gray-600">Assignment #{assignment.id.slice(-6)}</p>
          </div>
          <Button variant="outline" onClick={refreshData}>
            Refresh
          </Button>
        </div>

        {/* Current Phase */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {phaseInfo.icon}
                {phaseInfo.title}
              </CardTitle>
              <Badge className={`${phaseInfo.color} text-white`}>
                {assignment.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{phaseInfo.description}</p>
            
            {/* Location Info */}
            {currentLocation && destination && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                  <div className="text-sm font-medium">Distance</div>
                  <div className="text-lg font-bold text-blue-600">
                    {distance ? `${distance.toFixed(1)} km` : 'Calculating...'}
                  </div>
                </div>
                
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <Clock className="h-5 w-5 text-green-600 mx-auto mb-1" />
                  <div className="text-sm font-medium">ETA</div>
                  <div className="text-lg font-bold text-green-600">
                    {eta ? `${eta} min` : 'Calculating...'}
                  </div>
                </div>
                
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <Navigation className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                  <div className="text-sm font-medium">Status</div>
                  <div className="text-lg font-bold text-purple-600">
                    {isNearDestination ? 'Near Destination' : 'En Route'}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {assignment.status === 'accepted' && (
                <Button 
                  onClick={() => handleStatusUpdate('in_progress')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Start Journey
                </Button>
              )}
              
              {assignment.status === 'in_progress' && (
                <Button 
                  onClick={() => handleStatusUpdate('completed')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Assignment
                </Button>
              )}
              
              <Button 
                variant="outline"
                onClick={() => window.open(getDirectionsUrl(), '_blank')}
                disabled={!currentLocation || !destination}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Open in Maps
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => window.open(`tel:${accident.contactNumber}`, '_blank')}
              >
                <Phone className="h-4 w-4 mr-2" />
                Call Reporter
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Accident Details */}
        <Card>
          <CardHeader>
            <CardTitle>Accident Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={`${getSeverityColor(accident.severity)} text-white`}>
                  {accident.severity.toUpperCase()}
                </Badge>
                <span className="text-sm text-gray-600">
                  Reported: {new Date(accident.timestamp.seconds * 1000).toLocaleString()}
                </span>
              </div>
              
              <p className="text-gray-700">{accident.description}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Injured:</span> {accident.injuredCount}
                </div>
                <div>
                  <span className="font-medium">Vehicles:</span> {accident.vehiclesInvolved}
                </div>
                <div>
                  <span className="font-medium">Contact:</span> {accident.contactNumber}
                </div>
                <div>
                  <span className="font-medium">Location:</span> 
                  {accident.location.latitude.toFixed(4)}, {accident.location.longitude.toFixed(4)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hospital Details */}
        <Card>
          <CardHeader>
            <CardTitle>Destination Hospital</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <h3 className="font-medium text-lg">{hospital.name}</h3>
              <p className="text-gray-600">{hospital.address}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Available Beds:</span> {hospital.availableBeds}
                </div>
                <div>
                  <span className="font-medium">Total Beds:</span> {hospital.totalBeds}
                </div>
                <div>
                  <span className="font-medium">Phone:</span> {hospital.phoneNumber}
                </div>
              </div>
              
              {hospital.specialtyServices && hospital.specialtyServices.length > 0 && (
                <div>
                  <span className="font-medium">Specialty Services:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {hospital.specialtyServices.map((service, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current Location */}
        {currentLocation && (
          <Card>
            <CardHeader>
              <CardTitle>Current Location</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <div>
                  <span className="font-medium">Latitude:</span> {currentLocation.latitude.toFixed(6)}
                </div>
                <div>
                  <span className="font-medium">Longitude:</span> {currentLocation.longitude.toFixed(6)}
                </div>
                <div className="text-xs text-gray-500">
                  Location updates automatically every 30 seconds
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
