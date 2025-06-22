'use client';

import { useState, useEffect, useRef } from 'react';
import { Assignment, Accident, Hospital } from '@/types';
import { DatabaseService } from '@/services/databaseService';

interface Location {
  latitude: number;
  longitude: number;
}

interface UseAssignmentTrackingProps {
  assignmentId: string;
  onLocationUpdate?: (location: Location) => void;
  onStatusChange?: (status: Assignment['status']) => void;
}

export function useAssignmentTracking({
  assignmentId,
  onLocationUpdate,
  onStatusChange
}: UseAssignmentTrackingProps) {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [accident, setAccident] = useState<Accident | null>(null);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const watchId = useRef<number | null>(null);
  const intervalId = useRef<NodeJS.Timeout | null>(null);

  // Load assignment data
  useEffect(() => {
    loadAssignmentData();
  }, [assignmentId]);

  // Start location tracking
  useEffect(() => {
    if (assignment && accident) {
      startLocationTracking();
    }
    
    return () => {
      stopLocationTracking();
    };
  }, [assignment, accident]);

  // Update destination based on assignment status
  useEffect(() => {
    if (assignment && accident) {
      updateDestination();
    }
  }, [assignment?.status, accident, hospital]);

  const loadAssignmentData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load assignment
      const assignmentData = await DatabaseService.getAssignment(assignmentId);
      if (!assignmentData) {
        throw new Error('Assignment not found');
      }
      setAssignment(assignmentData);

      // Load accident
      const accidentData = await DatabaseService.getAccident(assignmentData.accidentId);
      if (!accidentData) {
        throw new Error('Accident not found');
      }
      setAccident(accidentData);

      // Load hospital
      const hospitalData = await DatabaseService.getHospital(assignmentData.hospitalId);
      if (!hospitalData) {
        throw new Error('Hospital not found');
      }
      setHospital(hospitalData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignment data');
    } finally {
      setLoading(false);
    }
  };

  const updateDestination = async () => {
    if (!assignment || !accident) return;

    try {
      let destination = accident.location;

      // Fixed: Use only valid Assignment status values
      if (assignment.status === 'completed') {
        // Driver has completed the assignment, destination is hospital
        const hospital = await DatabaseService.getHospital(assignment.hospitalId);
        if (hospital) {
          destination = hospital.location;
        }
      } else if (assignment.status === 'in_progress') {
        // Driver is en route or at scene, check if they need to go to hospital
        // This logic can be enhanced based on your business rules
        // For now, we'll assume they're going to the accident location first
        destination = accident.location;
      }

      setDestination(destination);
    } catch (err) {
      console.error('Error updating destination:', err);
    }
  };

  const startLocationTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    // Start watching position
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        
        setCurrentLocation(newLocation);
        onLocationUpdate?.(newLocation);
        
        // Update distance and ETA
        if (destination) {
          const dist = calculateDistance(newLocation, destination);
          setDistance(dist);
          setEta(calculateETA(dist));
        }
      },
      (error) => {
        setError(`Location error: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );

    // Update assignment location periodically
    intervalId.current = setInterval(() => {
      if (currentLocation && assignment) {
        updateAssignmentLocation(currentLocation);
      }
    }, 30000); // Update every 30 seconds
  };

  const stopLocationTracking = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    
    if (intervalId.current) {
      clearInterval(intervalId.current);
      intervalId.current = null;
    }
  };

  const updateAssignmentLocation = async (location: Location) => {
    try {
      await DatabaseService.updateAssignmentLocation(assignmentId, location);
    } catch (err) {
      console.error('Error updating assignment location:', err);
    }
  };

  const updateAssignmentStatus = async (newStatus: Assignment['status']) => {
    try {
      await DatabaseService.updateAssignmentStatus(assignmentId, newStatus);
      setAssignment(prev => prev ? { ...prev, status: newStatus } : null);
      onStatusChange?.(newStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const calculateDistance = (from: Location, to: Location): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (to.latitude - from.latitude) * Math.PI / 180;
    const dLon = (to.longitude - from.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(from.latitude * Math.PI / 180) * Math.cos(to.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateETA = (distanceKm: number): number => {
    // Assume average speed of 50 km/h for ambulance
    const averageSpeed = 50;
    return Math.round((distanceKm / averageSpeed) * 60); // ETA in minutes
  };

  const getDirectionsUrl = (): string => {
    if (!currentLocation || !destination) return '';
    
    return `https://www.google.com/maps/dir/${currentLocation.latitude},${currentLocation.longitude}/${destination.latitude},${destination.longitude}`;
  };

  return {
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
    refreshData: loadAssignmentData
  };
}
