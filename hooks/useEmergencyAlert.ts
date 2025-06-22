'use client';

import { useState, useCallback } from 'react';
import { EmergencyAlertState } from '@/types';
import { DatabaseService } from '@/services/databaseService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useEmergencyAlert() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [state, setState] = useState<EmergencyAlertState>({
    isReporting: false,
    isEmergencyActive: false,
    accidentId: null,
  });

  const reportEmergency = useCallback(async (emergencyData: {
    location: { latitude: number; longitude: number };
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    injuredCount: number;
    vehiclesInvolved: number;
    additionalInfo?: string;
    contactNumber: string;
  }) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to report an emergency.",
        variant: "destructive",
      });
      return;
    }

    setState(prev => ({ ...prev, isReporting: true }));

    try {
      console.log('🚨 Reporting emergency:', emergencyData);
      
      // Create accident record with proper structure
      const accidentData = {
        reporterId: user.id,
        location: emergencyData.location,
        description: emergencyData.description,
        severity: emergencyData.severity,
        status: 'pending',
        injuredCount: emergencyData.injuredCount,
        vehiclesInvolved: emergencyData.vehiclesInvolved,
        additionalInfo: emergencyData.additionalInfo || '',
        contactNumber: emergencyData.contactNumber,
      };

      const accidentId = await DatabaseService.createAccident(accidentData);
      console.log('✅ Emergency created with ID:', accidentId);

      // Update state immediately after successful creation
      setState({
        isReporting: false,
        isEmergencyActive: true,
        accidentId,
      });

      // Show success toast
      toast({
        title: "Emergency Reported Successfully! 🚨",
        description: "Your emergency has been reported. Notifying nearby hospitals...",
      });

      // Notify nearby hospitals in background (don't wait for it)
      notifyNearbyHospitals(accidentId, emergencyData.location)
        .then(() => {
          console.log('✅ Hospital notification completed');
          toast({
            title: "Hospitals Notified! 🏥",
            description: "Nearby hospitals have been alerted about your emergency.",
          });
        })
        .catch((error) => {
          console.warn('⚠️ Hospital notification failed:', error);
          // Don't show error toast as the emergency was still reported successfully
        });

      return accidentId;
    } catch (error) {
      console.error('❌ Error reporting emergency:', error);
      setState(prev => ({ ...prev, isReporting: false }));
      
      toast({
        title: "Error Reporting Emergency",
        description: "Failed to report emergency. Please try again or call 108 (Ambulance) or 112 (National Emergency) directly.",
        variant: "destructive",
      });
      
      throw error;
    }
  }, [user, toast]);

  const notifyNearbyHospitals = async (accidentId: string, location: { latitude: number; longitude: number }) => {
    try {
      console.log('🏥 Notifying nearby hospitals for accident:', accidentId);
      
      // Get nearby hospitals (within 50km)
      const nearbyHospitals = await DatabaseService.getNearbyHospitals(
        location.latitude, 
        location.longitude, 
        50
      );

      console.log(`📍 Found ${nearbyHospitals.length} nearby hospitals`);

      if (nearbyHospitals.length > 0) {
        // First, update accident status to indicate hospitals are being notified
        await DatabaseService.updateAccidentStatus(accidentId, 'hospital_notified');
        console.log('✅ Updated accident status to hospital_notified');

        // Create hospital notifications
        const notificationPromises = nearbyHospitals.map(hospital => {
          const distance = DatabaseService.calculateDistance(
            location.latitude,
            location.longitude,
            hospital.location.latitude,
            hospital.location.longitude
          );

          return DatabaseService.createHospitalNotification({
            accidentId,
            hospitalId: hospital.id,
            type: 'emergency_nearby',
            status: 'pending',
            distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
          });
        });
        await Promise.all(notificationPromises);
        console.log(`✅ Successfully notified ${nearbyHospitals.length} hospitals`);
      } else {
        console.log('⚠️ No nearby hospitals found');
        // Keep status as 'pending' if no hospitals found
      }
    } catch (error) {
      console.error('❌ Error notifying hospitals:', error);
      throw error;
    }
  };

  const clearEmergencyState = useCallback(() => {
    setState({
      isReporting: false,
      isEmergencyActive: false,
      accidentId: null,
    });
  }, []);

  const showEmergencyContacts = useCallback(() => {
    toast({
      title: "🚨 Emergency Contacts (India)",
      description: "Police: 100 | Fire: 101 | Ambulance: 108 | National Emergency: 112",
      duration: 10000,
    });
  }, [toast]);

  const callEmergencyNumber = useCallback((number: string) => {
    if (typeof window !== 'undefined') {
      window.location.href = `tel:${number}`;
    }
  }, []);

  return {
    state,
    reportEmergency,
    clearEmergencyState,
    showEmergencyContacts,
    callEmergencyNumber,
    emergencyNumbers: {
      police: '100',
      fire: '101',
      ambulance: '108',
      nationalEmergency: '112',
      womenHelpline: '1091',
      childHelpline: '1098',
      touristHelpline: '1363',
    },
  };
}
