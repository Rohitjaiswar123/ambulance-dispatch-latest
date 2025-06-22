import { collection, addDoc, Timestamp } from 'firebase/firestore';
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

  private constructor() {}

  static getInstance(): EmergencyDetectionService {
    if (!EmergencyDetectionService.instance) {
      EmergencyDetectionService.instance = new EmergencyDetectionService();
    }
    return EmergencyDetectionService.instance;
  }

  // Monitor sensor data for emergency conditions
  async monitorSensorData(esp32Data: Partial<ESP32Data>): Promise<EmergencyDetection[]> {
    try {
      if (!esp32Data.sensor || !esp32Data.gps || !esp32Data.mpu6050) {
        return [];
      }

      const conditions = this.checkEmergencyConditions(esp32Data);
      const detectedEmergencies: EmergencyDetection[] = [];

      for (const condition of conditions) {
        if (condition.detected && this.shouldTriggerEmergency(condition.type)) {
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
    conditions.push({
      type: 'gas',
      detected: gasLevel > EMERGENCY_THRESHOLDS.GAS_CRITICAL,
      value: gasLevel,
      threshold: EMERGENCY_THRESHOLDS.GAS_CRITICAL,
      message: `Critical gas level detected: ${gasLevel.toLocaleString()} PPM`
    });

    // Temperature emergency
    const temperature = esp32Data.sensor!.temperature;
    conditions.push({
      type: 'temperature',
      detected: temperature > EMERGENCY_THRESHOLDS.TEMPERATURE_CRITICAL,
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
    conditions.push({
      type: 'crash',
      detected: totalAcceleration > EMERGENCY_THRESHOLDS.CRASH_ACCELERATION,
      value: totalAcceleration,
      threshold: EMERGENCY_THRESHOLDS.CRASH_ACCELERATION,
      message: `Crash detected: ${totalAcceleration.toFixed(2)}G acceleration`
    });

    // Speed-related emergency (sudden stop)
    const currentSpeed = esp32Data.gps!.speed;
    conditions.push({
      type: 'speed',
      detected: this.detectSuddenSpeedChange(currentSpeed),
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
      return false; // Still in cooldown period
    }

    this.lastEmergencyTime.set(type, now);
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

      console.log(`🚨 Emergency detected: ${condition.type} - ${condition.message}`);
      
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
      // Generate accident description based on emergency type
      const description = this.generateAccidentDescription(emergency);
      
      // Determine severity based on trigger type and value
      const severity = this.determineSeverity(emergency);

      // Create accident data with ALL required fields
      const accidentData = {
        location: {
          latitude: esp32Data.gps!.latitude,
          longitude: esp32Data.gps!.longitude
        },
        description,
        severity,
        injuredCount: 1,
        vehiclesInvolved: 1,
        additionalInfo: `Auto-generated from IoT sensor detection. Device: ${emergency.deviceId}. Trigger: ${emergency.triggerType} (${emergency.triggerValue} > ${emergency.threshold})`,
        contactNumber: IOT_DEVICE.ASSIGNED_USER,
        status: 'pending' as const,
        timestamp: Timestamp.now(),
        createdBy: 'SYSTEM_IOT' // System-generated accident
      };

      // Create accident using existing database service
      const accidentId = await DatabaseService.createAccident(accidentData);

      if (accidentId) {
        // Update emergency detection with accident ID
        await DatabaseService.updateDocument('emergencyDetections', emergency.id!, {
          accidentId,
          status: 'processed'
        });

        console.log(`✅ Auto-created accident ${accidentId} from IoT emergency ${emergency.id}`);
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
        return `AUTOMATIC ALERT: Critical gas leak detected at ${locationStr}. Gas level: ${emergency.triggerValue.toLocaleString()} PPM (Critical threshold: ${emergency.threshold.toLocaleString()} PPM). Immediate evacuation and emergency response required.`;
      
      case 'temperature':
        return `AUTOMATIC ALERT: Critical temperature detected at ${locationStr}. Temperature: ${emergency.triggerValue}°C (Critical threshold: ${emergency.threshold}°C). Possible fire or overheating emergency.`;
      
      case 'crash':
        return `AUTOMATIC ALERT: Vehicle crash detected at ${locationStr}. Impact force: ${emergency.triggerValue.toFixed(2)}G (Threshold: ${emergency.threshold}G). Vehicle occupants may be injured.`;
      
      case 'speed':
        return `AUTOMATIC ALERT: Sudden vehicle stop detected at ${locationStr}. Current speed: ${emergency.triggerValue} km/h. Possible accident or emergency braking situation.`;
      
      case 'gps':
        return `AUTOMATIC ALERT: GPS-based emergency detected at ${locationStr}. Location-based emergency condition triggered.`;
      
      default:
        return `AUTOMATIC ALERT: Emergency condition detected at ${locationStr}. IoT sensor triggered emergency response.`;
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
