import { collection, addDoc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { EmergencyDetection, ESP32Data, EMERGENCY_THRESHOLDS, IOT_DEVICE } from '@/types/iot';
import { DatabaseService } from '@/services/databaseService';

interface EmergencyCondition {
  type: EmergencyDetection['triggerType'];
  detected: boolean;
  value: number;
  threshold: number;
  message: string;
}

export class EmergencyDetectionService {
  private static instance: EmergencyDetectionService;
  private lastEmergencyTime: Map<string, number> = new Map();
  private readonly EMERGENCY_COOLDOWN = 300000; // 5 minutes between same type emergencies
  private assignedUserId: string | null = null;

  private constructor() {}

  static getInstance(): EmergencyDetectionService {
    if (!EmergencyDetectionService.instance) {
      EmergencyDetectionService.instance = new EmergencyDetectionService();
    }
    return EmergencyDetectionService.instance;
  }

  // Get the user ID for the assigned email
  private async getAssignedUserId(): Promise<string | null> {
    if (this.assignedUserId) {
      return this.assignedUserId;
    }

    try {
      console.log('🔍 Looking for user with email:', IOT_DEVICE.ASSIGNED_USER);
      
      // Query users collection by email
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', IOT_DEVICE.ASSIGNED_USER)
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      if (!usersSnapshot.empty) {
        this.assignedUserId = usersSnapshot.docs[0].id;
        console.log('✅ Found assigned user ID:', this.assignedUserId);
        return this.assignedUserId;
      }

      // Also check vehicle_drivers collection
      const driversQuery = query(
        collection(db, 'vehicle_drivers'),
        where('email', '==', IOT_DEVICE.ASSIGNED_USER)
      );
      const driversSnapshot = await getDocs(driversQuery);
      
      if (!driversSnapshot.empty) {
        const driverData = driversSnapshot.docs[0].data();
        this.assignedUserId = driverData.userId || driversSnapshot.docs[0].id;
        console.log('✅ Found assigned user ID from vehicle_drivers:', this.assignedUserId);
        return this.assignedUserId;
      }

      console.log('❌ No user found with email:', IOT_DEVICE.ASSIGNED_USER);
      return null;
    } catch (error) {
      console.error('❌ Error finding assigned user:', error);
      return null;
    }
  }

  // Monitor sensor data for emergency conditions
  async monitorSensorData(esp32Data: Partial<ESP32Data>): Promise<EmergencyDetection[]> {
    try {
      if (!esp32Data.sensor || !esp32Data.gps || !esp32Data.mpu6050) {
        return [];
      }

      console.log('🔍 Monitoring sensor data for emergencies...');
      console.log('📊 Current sensor values:', {
        temperature: esp32Data.sensor.temperature,
        gas: esp32Data.sensor.lpg_ppm,
        location: `${esp32Data.gps.latitude}, ${esp32Data.gps.longitude}`
      });

      const conditions = this.checkEmergencyConditions(esp32Data);
      const detectedEmergencies: EmergencyDetection[] = [];

      for (const condition of conditions) {
        if (condition.detected && this.shouldTriggerEmergency(condition.type)) {
          console.log('🚨 Emergency condition detected:', condition);
          
          const emergency = await this.createEmergencyDetection(condition, esp32Data);
          if (emergency) {
            detectedEmergencies.push(emergency);
            
            // Auto-create accident report
            await this.createAccidentFromEmergency(emergency, esp32Data);
          }
        }
      }

      return detectedEmergencies;
    } catch (error) {
      console.error('❌ Error monitoring sensor data:', error);
      throw error;
    }
  }

  // Check all emergency conditions
  private checkEmergencyConditions(esp32Data: Partial<ESP32Data>): EmergencyCondition[] {
    const conditions: EmergencyCondition[] = [];

    // Gas level emergency
    const gasLevel = esp32Data.sensor!.lpg_ppm;
    const gasEmergency = gasLevel > EMERGENCY_THRESHOLDS.GAS_CRITICAL;
    console.log(`🔍 Gas check: ${gasLevel} PPM (Critical: ${EMERGENCY_THRESHOLDS.GAS_CRITICAL}) - ${gasEmergency ? 'EMERGENCY!' : 'Normal'}`);
    
    conditions.push({
      type: 'gas',
      detected: gasEmergency,
      value: gasLevel,
      threshold: EMERGENCY_THRESHOLDS.GAS_CRITICAL,
      message: `Critical gas level detected: ${gasLevel.toLocaleString()} PPM`
    });

    // Temperature emergency
    const temperature = esp32Data.sensor!.temperature;
    const tempEmergency = temperature > EMERGENCY_THRESHOLDS.TEMPERATURE_CRITICAL;
    console.log(`🔍 Temperature check: ${temperature}°C (Critical: ${EMERGENCY_THRESHOLDS.TEMPERATURE_CRITICAL}) - ${tempEmergency ? 'EMERGENCY!' : 'Normal'}`);
    
    conditions.push({
      type: 'temperature',
      detected: tempEmergency,
      value: temperature,
      threshold: EMERGENCY_THRESHOLDS.TEMPERATURE_CRITICAL,
      message: `Critical temperature detected: ${temperature}°C`
    });

    // Crash detection (high G-force)
    const totalAcceleration = Math.sqrt(
      Math.pow(esp32Data.mpu6050!.accel_x, 2) +
      Math.pow(esp32Data.mpu6050!.accel_y, 2) +
      Math.pow(esp32Data.mpu6050!.accel_z, 2)
    );
    const crashEmergency = totalAcceleration > EMERGENCY_THRESHOLDS.CRASH_ACCELERATION;
    console.log(`🔍 Crash check: ${totalAcceleration.toFixed(2)}G (Critical: ${EMERGENCY_THRESHOLDS.CRASH_ACCELERATION}) - ${crashEmergency ? 'EMERGENCY!' : 'Normal'}`);
    
    conditions.push({
      type: 'crash',
      detected: crashEmergency,
      value: totalAcceleration,
      threshold: EMERGENCY_THRESHOLDS.CRASH_ACCELERATION,
      message: `Crash detected: ${totalAcceleration.toFixed(2)}G acceleration`
    });

    // Speed-related emergency (sudden stop)
    const currentSpeed = esp32Data.gps!.speed;
    const speedEmergency = this.detectSuddenSpeedChange(currentSpeed);
    console.log(`🔍 Speed check: ${currentSpeed} km/h - ${speedEmergency ? 'EMERGENCY!' : 'Normal'}`);
    
    conditions.push({
      type: 'speed',
      detected: speedEmergency,
      value: currentSpeed,
      threshold: EMERGENCY_THRESHOLDS.SPEED_SUDDEN_STOP,
      message: `Sudden speed change detected: ${currentSpeed} km/h`
    });

    return conditions;
  }

  // Check if emergency should be triggered (cooldown logic)
  private shouldTriggerEmergency(type: EmergencyDetection['triggerType']): boolean {
    const lastTime = this.lastEmergencyTime.get(type) || 0;
    const now = Date.now();
    
    if (now - lastTime < this.EMERGENCY_COOLDOWN) {
      console.log(`⏰ Emergency type ${type} is in cooldown period`);
      return false; // Still in cooldown period
    }

    this.lastEmergencyTime.set(type, now);
    console.log(`✅ Emergency type ${type} can be triggered`);
    return true;
  }

  // Detect sudden speed changes (simplified logic)
  private detectSuddenSpeedChange(currentSpeed: number): boolean {
    // In a real implementation, you'd compare with previous speed readings
    // For now, we'll detect if speed drops to near zero suddenly
    return currentSpeed < 5 && currentSpeed >= 0; // Sudden stop
  }

  // Create emergency detection record
  private async createEmergencyDetection(
    condition: EmergencyCondition,
    esp32Data: Partial<ESP32Data>
  ): Promise<EmergencyDetection | null> {
    try {
      console.log('📝 Creating emergency detection record...');
      
      const emergency: Omit<EmergencyDetection, 'id'> = {
        deviceId: IOT_DEVICE.ID,
        detectedAt: Timestamp.now(),
        triggerType: condition.type,
        triggerValue: condition.value,
        threshold: condition.threshold,
        sensorSnapshot: {
          temperature: esp32Data.sensor!.temperature,
          humidity: esp32Data.sensor!.humidity,
          smokeLevel: esp32Data.sensor!.lpg_ppm,
          location: {
            lat: esp32Data.gps!.latitude,
            lng: esp32Data.gps!.longitude
          },
          speed: esp32Data.gps!.speed,
          accelerometer: {
            x: esp32Data.mpu6050!.accel_x,
            y: esp32Data.mpu6050!.accel_y,
            z: esp32Data.mpu6050!.accel_z
          },
          gyroscope: {
            x: esp32Data.mpu6050!.gyro_x,
            y: esp32Data.mpu6050!.gyro_y,
            z: esp32Data.mpu6050!.gyro_z
          }
        },
        status: 'detected'
      };

      const docRef = await addDoc(collection(db, 'emergencyDetections'), emergency);
      const emergencyWithId = { id: docRef.id, ...emergency };

      console.log(`🚨 Emergency detection created: ${condition.type} - ${condition.message}`);
      
      return emergencyWithId;
    } catch (error) {
      console.error('❌ Error creating emergency detection:', error);
      return null;
    }
  }

  // Auto-create accident report from emergency detection
  private async createAccidentFromEmergency(
    emergency: EmergencyDetection,
    esp32Data: Partial<ESP32Data>
  ): Promise<void> {
    try {
      console.log('🚨 Creating accident report from IoT emergency...');
      
      // Get the assigned user ID
      const assignedUserId = await this.getAssignedUserId();
      if (!assignedUserId) {
        console.error('❌ Cannot create accident: No assigned user found for', IOT_DEVICE.ASSIGNED_USER);
        return;
      }

      console.log('✅ Creating accident for user ID:', assignedUserId);

      // Generate accident description based on emergency type
      const description = this.generateAccidentDescription(emergency);
      
      // Determine severity based on trigger type and value
      const severity = this.determineSeverity(emergency);

      // Create accident data with ALL required fields
      const accidentData = {
        reporterId: assignedUserId, // Use the actual user ID
        location: {
          latitude: esp32Data.gps!.latitude,
          longitude: esp32Data.gps!.longitude
        },
        description,
        severity,
        injuredCount: 1,
        vehiclesInvolved: 1,
        additionalInfo: `🤖 AUTO-GENERATED from IoT sensor detection.\n\nDevice: ${emergency.deviceId}\nTrigger: ${emergency.triggerType.toUpperCase()}\nValue: ${emergency.triggerValue}\nThreshold: ${emergency.threshold}\nAssigned User: ${IOT_DEVICE.ASSIGNED_USER}`,
        contactNumber: IOT_DEVICE.CONTACT_NUMBER,
        status: 'pending' as const,
        timestamp: Timestamp.now(),
        createdBy: 'SYSTEM_IOT', // Keep this for system tracking
        iotEmergencyId: emergency.id // Link to emergency detection
      };

      console.log('📋 Accident data to create:', {
        reporterId: accidentData.reporterId,
        severity: accidentData.severity,
        triggerType: emergency.triggerType,
        location: accidentData.location
      });

      // Create accident using existing database service
      const accidentId = await DatabaseService.createAccident(accidentData);

      if (accidentId) {
        // Update emergency detection with accident ID
        await DatabaseService.updateDocument('emergencyDetections', emergency.id!, {
          accidentId,
          status: 'processed'
        });

        console.log(`✅ SUCCESS: Auto-created accident ${accidentId} from IoT emergency ${emergency.id}`);
        console.log(`📧 Accident assigned to user: ${IOT_DEVICE.ASSIGNED_USER} (ID: ${assignedUserId})`);
      } else {
        console.error('❌ Failed to create accident - no ID returned');
      }
    } catch (error) {
      console.error('❌ Error creating accident from emergency:', error);
    }
  }

  // Generate human-readable accident description
  private generateAccidentDescription(emergency: EmergencyDetection): string {
    const location = emergency.sensorSnapshot.location;
    const locationStr = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;

    switch (emergency.triggerType) {
      case 'gas':
        return `🚨 AUTOMATIC IoT ALERT: Critical gas leak detected at ${locationStr}. Gas level: ${emergency.triggerValue.toLocaleString()} PPM (Critical threshold: ${emergency.threshold.toLocaleString()} PPM). Immediate evacuation and emergency response required. Device: ${emergency.deviceId}`;
      
      case 'temperature':
        return `🚨 AUTOMATIC IoT ALERT: Critical temperature detected at ${locationStr}. Temperature: ${emergency.triggerValue}°C (Critical threshold: ${emergency.threshold}°C). Possible fire or overheating emergency. Device: ${emergency.deviceId}`;
      
        case 'crash':
          return `🚨 AUTOMATIC IoT ALERT: Vehicle crash detected at ${locationStr}. Impact force: ${emergency.triggerValue.toFixed(2)}G (Threshold: ${emergency.threshold}G). Vehicle occupants may be injured. Device: ${emergency.deviceId}`;
        
        case 'speed':
          return `🚨 AUTOMATIC IoT ALERT: Sudden vehicle stop detected at ${locationStr}. Current speed: ${emergency.triggerValue} km/h. Possible accident or emergency braking situation. Device: ${emergency.deviceId}`;
        
        case 'gps':
          return `🚨 AUTOMATIC IoT ALERT: GPS-based emergency detected at ${locationStr}. Location-based emergency condition triggered. Device: ${emergency.deviceId}`;
        
        default:
          return `🚨 AUTOMATIC IoT ALERT: Emergency condition detected at ${locationStr}. IoT sensor triggered emergency response. Device: ${emergency.deviceId}`;
      }
    }
  
    // Determine accident severity based on emergency data
    private determineSeverity(emergency: EmergencyDetection): 'low' | 'medium' | 'high' | 'critical' {
      switch (emergency.triggerType) {
        case 'gas':
          if (emergency.triggerValue > EMERGENCY_THRESHOLDS.GAS_CRITICAL * 2) {
            return 'critical';
          }
          return 'high';
        
        case 'temperature':
          if (emergency.triggerValue > 80) {
            return 'critical';
          }
          return 'high';
        
        case 'crash':
          if (emergency.triggerValue > 5.0) {
            return 'critical';
          }
          return 'high';
        
        case 'speed':
          return 'medium';
        
        default:
          return 'medium';
      }
    }
  
    // Get emergency detection statistics
    async getEmergencyStatistics(hours: number = 24): Promise<{
      totalEmergencies: number;
      byType: Record<EmergencyDetection['triggerType'], number>;
      resolved: number;
      pending: number;
    }> {
      try {
        // This would query the emergencyDetections collection
        // Implementation would be similar to sensor history queries
        
        return {
          totalEmergencies: 0,
          byType: {
            gas: 0,
            temperature: 0,
            crash: 0,
            speed: 0,
            gps: 0
          },
          resolved: 0,
          pending: 0
        };
      } catch (error) {
        console.error('❌ Error getting emergency statistics:', error);
        throw error;
      }
    }
  }
  
  export default EmergencyDetectionService;
  