import { collection, addDoc, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { SensorHistoryRecord, ESP32Data, IOT_DEVICE } from '@/types/iot';

export class SensorHistoryService {
  private static instance: SensorHistoryService;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly SNAPSHOT_INTERVAL = 30000; // 30 seconds
  private readonly MAX_RECORDS_PER_DAY = 2880; // 24 hours * 60 minutes * 2 (every 30 seconds)

  private constructor() {}

  static getInstance(): SensorHistoryService {
    if (!SensorHistoryService.instance) {
      SensorHistoryService.instance = new SensorHistoryService();
    }
    return SensorHistoryService.instance;
  }

  // Start periodic sensor data snapshots
  startPeriodicSnapshots(getCurrentData: () => Partial<ESP32Data>) {
    if (this.intervalId) {
      console.log('⚠️ Periodic snapshots already running');
      return;
    }

    this.intervalId = setInterval(async () => {
      try {
        const currentData = getCurrentData();
        if (currentData && currentData.sensor && currentData.gps && currentData.mpu6050) {
          await this.createSnapshot(currentData);
        } else {
          console.log('⚠️ Incomplete ESP32 data, skipping snapshot');
        }
      } catch (error) {
        console.error('❌ Error creating periodic snapshot:', error);
        // Don't stop the interval on error, just log it
      }
    }, this.SNAPSHOT_INTERVAL);

    console.log(`✅ Started periodic sensor snapshots (every ${this.SNAPSHOT_INTERVAL/1000}s)`);
  }

  // Stop periodic snapshots
  stopPeriodicSnapshots() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Stopped periodic sensor snapshots');
    }
  }

  // Create a sensor history snapshot
  async createSnapshot(esp32Data: Partial<ESP32Data>): Promise<string | null> {
    try {
      // Validate required data
      if (!esp32Data.sensor || !esp32Data.gps || !esp32Data.mpu6050) {
        console.warn('⚠️ Incomplete ESP32 data, skipping snapshot');
        return null;
      }

      // Create a clean record object with proper data types
      const record = {
        deviceId: IOT_DEVICE.ID,
        recordedAt: Timestamp.now(),
        temperature: Number(esp32Data.sensor.temperature) || 0,
        humidity: Number(esp32Data.sensor.humidity) || 0,
        smokeLevel: Number(esp32Data.sensor.lpg_ppm) || 0,
        location: {
          lat: Number(esp32Data.gps.latitude) || 0,
          lng: Number(esp32Data.gps.longitude) || 0
        },
        speed: Number(esp32Data.gps.speed) || 0,
        accelerometer: {
          x: Number(esp32Data.mpu6050.accel_x) || 0,
          y: Number(esp32Data.mpu6050.accel_y) || 0,
          z: Number(esp32Data.mpu6050.accel_z) || 0
        },
        gyroscope: {
          x: Number(esp32Data.mpu6050.gyro_x) || 0,
          y: Number(esp32Data.mpu6050.gyro_y) || 0,
          z: Number(esp32Data.mpu6050.gyro_z) || 0
        },
        // Add metadata for debugging
        createdBy: 'ESP32_SYSTEM',
        version: '1.0',
        // Add timestamp for debugging
        clientTimestamp: new Date().toISOString()
      };

      // Log the data being saved for debugging
      console.log('📊 Creating sensor snapshot:', {
        deviceId: record.deviceId,
        temperature: record.temperature,
        humidity: record.humidity,
        smokeLevel: record.smokeLevel,
        location: record.location,
        timestamp: record.clientTimestamp
      });

      // Try to create the document with error handling
      const docRef = await addDoc(collection(db, 'sensorHistory'), record);
      console.log('✅ Sensor snapshot created successfully:', docRef.id);
      
      // Cleanup old records periodically (every 10th snapshot)
      if (Math.random() < 0.1) {
        await this.cleanupOldRecords();
      }
      
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating sensor snapshot:', error);
      
      // Log more details about the error
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        if (error.message.includes('Missing or insufficient permissions')) {
          console.error('🔒 Firestore permission denied. Check if user is authenticated and rules allow writes to sensorHistory collection');
        }
      }
      
      // Don't throw the error, just return null to prevent breaking the app
      return null;
    }
  }

  // Get recent sensor history
  async getRecentHistory(hours: number = 24): Promise<SensorHistoryRecord[]> {
    try {
      const hoursAgo = new Date();
      hoursAgo.setHours(hoursAgo.getHours() - hours);

      const q = query(
        collection(db, 'sensorHistory'),
        where('deviceId', '==', IOT_DEVICE.ID),
        where('recordedAt', '>=', Timestamp.fromDate(hoursAgo)),
        orderBy('recordedAt', 'desc'),
        limit(200)
      );

      const querySnapshot = await getDocs(q);
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SensorHistoryRecord[];

      console.log(`📈 Retrieved ${records.length} sensor history records`);
      return records;
    } catch (error) {
      console.error('❌ Error getting sensor history:', error);
      return []; // Return empty array instead of throwing
    }
  }

  // Get sensor data before/after specific time (for accident analysis)
  async getSensorDataAroundTime(
    targetTime: Date, 
    minutesBefore: number = 10, 
    minutesAfter: number = 5
  ): Promise<{
    before: SensorHistoryRecord[];
    after: SensorHistoryRecord[];
  }> {
    try {
      const beforeTime = new Date(targetTime.getTime() - (minutesBefore * 60 * 1000));
      const afterTime = new Date(targetTime.getTime() + (minutesAfter * 60 * 1000));

      // Get data before the incident
      const beforeQuery = query(
        collection(db, 'sensorHistory'),
        where('deviceId', '==', IOT_DEVICE.ID),
        where('recordedAt', '>=', Timestamp.fromDate(beforeTime)),
        where('recordedAt', '<', Timestamp.fromDate(targetTime)),
        orderBy('recordedAt', 'desc')
      );

      // Get data after the incident
      const afterQuery = query(
        collection(db, 'sensorHistory'),
        where('deviceId', '==', IOT_DEVICE.ID),
        where('recordedAt', '>', Timestamp.fromDate(targetTime)),
        where('recordedAt', '<=', Timestamp.fromDate(afterTime)),
        orderBy('recordedAt', 'asc')
      );

      const [beforeSnapshot, afterSnapshot] = await Promise.all([
        getDocs(beforeQuery),
        getDocs(afterQuery)
      ]);

      const before = beforeSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SensorHistoryRecord[];

      const after = afterSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SensorHistoryRecord[];

      console.log(`🔍 Accident analysis data: ${before.length} before, ${after.length} after`);
      
      return { before, after };
    } catch (error) {
      console.error('❌ Error getting sensor data around time:', error);
      return { before: [], after: [] };
    }
  }

  // Cleanup old records (keep only last 7 days)
  private async cleanupOldRecords() {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const q = query(
        collection(db, 'sensorHistory'),
        where('deviceId', '==', IOT_DEVICE.ID),
        where('recordedAt', '<', Timestamp.fromDate(sevenDaysAgo)),
        limit(50) // Delete in batches
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.docs.length > 0) {
        console.log(`🧹 Found ${querySnapshot.docs.length} old records to cleanup`);
        // In a real app, you'd use batch delete here
        // For now, just log the cleanup opportunity
      }
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }

  // Get sensor statistics for dashboard
  async getSensorStatistics(hours: number = 24): Promise<{
    avgTemperature: number;
    maxTemperature: number;
    avgHumidity: number;
    maxGasLevel: number;
    totalDistance: number;
    maxSpeed: number;
  }> {
    try {
      const records = await this.getRecentHistory(hours);
      
      if (records.length === 0) {
        return {
          avgTemperature: 0,
          maxTemperature: 0,
          avgHumidity: 0,
          maxGasLevel: 0,
          totalDistance: 0,
          maxSpeed: 0
        };
      }

      const stats = records.reduce((acc, record) => {
        acc.totalTemp += record.temperature;
        acc.totalHumidity += record.humidity;
        acc.maxTemp = Math.max(acc.maxTemp, record.temperature);
        acc.maxGas = Math.max(acc.maxGas, record.smokeLevel);
        acc.maxSpeed = Math.max(acc.maxSpeed, record.speed);
        return acc;
      }, {
        totalTemp: 0,
        totalHumidity: 0,
        maxTemp: 0,
        maxGas: 0,
        maxSpeed: 0
      });

      return {
        avgTemperature: stats.totalTemp / records.length,
        maxTemperature: stats.maxTemp,
        avgHumidity: stats.totalHumidity / records.length,
        maxGasLevel: stats.maxGas,
        totalDistance: 0, // Would need to calculate from GPS coordinates
        maxSpeed: stats.maxSpeed
      };
    } catch (error) {
      console.error('❌ Error calculating sensor statistics:', error);
      return {
        avgTemperature: 0,
        maxTemperature: 0,
        avgHumidity: 0,
        maxGasLevel: 0,
        totalDistance: 0,
        maxSpeed: 0
      };
    }
  }

  // Test method to verify Firestore connection
  async testFirestoreConnection(): Promise<boolean> {
    try {
      const testData = {
        test: true,
        timestamp: Timestamp.now(),
        deviceId: IOT_DEVICE.ID,
        testMessage: 'Firestore connection test'
      };

      const docRef = await addDoc(collection(db, 'sensorHistory'), testData);
      console.log('✅ Firestore test successful:', docRef.id);
      return true;
    } catch (error) {
      console.error('❌ Firestore test failed:', error);
      if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
        console.error('🔒 Permission issue: Check Firestore rules and user authentication');
      }
      return false;
    }
  }
}

export default SensorHistoryService;
