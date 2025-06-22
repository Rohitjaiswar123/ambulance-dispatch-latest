import { getDatabase, ref, onValue, off, DatabaseReference } from 'firebase/database';
import { initializeApp } from 'firebase/app';
import { ESP32Data, ESP32SensorData, ESP32GPSData, ESP32MPUData } from '@/types/iot';

// Use the ESP32's Firebase Realtime Database configuration
const esp32Config = {
  apiKey: "AIzaSyBwbjQq0Zyx8PQLj77i0V9A69FyDCMI4xI",
  databaseURL: "https://esp32datatransfertest-default-rtdb.firebaseio.com"
};

// Initialize separate Firebase app for ESP32 data
const esp32App = initializeApp(esp32Config, 'esp32-realtime');
const realtimeDb = getDatabase(esp32App);

export class IoTRealtimeService {
  private static instance: IoTRealtimeService;
  private listeners: Map<string, DatabaseReference> = new Map();
  private currentData: Partial<ESP32Data> = {};

  private constructor() {}

  static getInstance(): IoTRealtimeService {
    if (!IoTRealtimeService.instance) {
      IoTRealtimeService.instance = new IoTRealtimeService();
    }
    return IoTRealtimeService.instance;
  }

  // Listen to all ESP32 data paths (same as Rakshak app.js)
  startListening(callbacks: {
    onSensorUpdate?: (data: ESP32SensorData) => void;
    onGPSUpdate?: (data: ESP32GPSData) => void;
    onMPUUpdate?: (data: ESP32MPUData) => void;
    onError?: (error: Error) => void;
  }) {
    try {
      console.log('🔄 Starting IoT Real-time listeners...');
      
      // Listen to sensor data (temperature, humidity, lpg_ppm)
      this.listenToSensor(callbacks.onSensorUpdate, callbacks.onError);
      
      // Listen to GPS data
      this.listenToGPS(callbacks.onGPSUpdate, callbacks.onError);
      
      // Listen to MPU6050 data
      this.listenToMPU(callbacks.onMPUUpdate, callbacks.onError);

      console.log('✅ IoT Real-time listeners started');
    } catch (error) {
      console.error('❌ Error starting IoT listeners:', error);
      callbacks.onError?.(error as Error);
    }
  }

  // Listen to sensor data (same as Rakshak: database.ref('sensor/temperature').on('value'))
  private listenToSensor(onUpdate?: (data: ESP32SensorData) => void, onError?: (error: Error) => void) {
    const sensorRef = ref(realtimeDb, 'sensor');
    
    onValue(sensorRef, (snapshot) => {
      try {
        const sensorData = snapshot.val() as ESP32SensorData;
        if (sensorData && sensorData.temperature !== undefined) {
          this.currentData.sensor = sensorData;
          onUpdate?.(sensorData);
          console.log('📊 Sensor data updated:', sensorData);
        }
      } catch (error) {
        console.error('❌ Error processing sensor data:', error);
        onError?.(error as Error);
      }
    }, (error) => {
      console.error('❌ Sensor listener error:', error);
      onError?.(error);
    });

    this.listeners.set('sensor', sensorRef);
  }

  // Listen to GPS data (same as Rakshak: database.ref('gps').on('value'))
  private listenToGPS(onUpdate?: (data: ESP32GPSData) => void, onError?: (error: Error) => void) {
    const gpsRef = ref(realtimeDb, 'gps');
    
    onValue(gpsRef, (snapshot) => {
      try {
        const gpsData = snapshot.val() as ESP32GPSData;
        if (gpsData && gpsData.latitude !== undefined) {
          this.currentData.gps = gpsData;
          onUpdate?.(gpsData);
          console.log('📍 GPS data updated:', gpsData);
        }
      } catch (error) {
        console.error('❌ Error processing GPS data:', error);
        onError?.(error as Error);
      }
    }, (error) => {
      console.error('❌ GPS listener error:', error);
      onError?.(error);
    });

    this.listeners.set('gps', gpsRef);
  }

  // Listen to MPU6050 data (accelerometer/gyroscope)
  private listenToMPU(onUpdate?: (data: ESP32MPUData) => void, onError?: (error: Error) => void) {
    const mpuRef = ref(realtimeDb, 'mpu6050');
    
    onValue(mpuRef, (snapshot) => {
      try {
        const mpuData = snapshot.val() as ESP32MPUData;
        if (mpuData && mpuData.accel_x !== undefined) {
          this.currentData.mpu6050 = mpuData;
          onUpdate?.(mpuData);
          console.log('🔄 MPU6050 data updated:', mpuData);
        }
      } catch (error) {
        console.error('❌ Error processing MPU data:', error);
        onError?.(error as Error);
      }
    }, (error) => {
      console.error('❌ MPU listener error:', error);
      onError?.(error);
    });

    this.listeners.set('mpu6050', mpuRef);
  }

  // Get current complete data
  getCurrentData(): Partial<ESP32Data> {
    return { ...this.currentData };
  }

  // Stop all listeners
  stopListening() {
    this.listeners.forEach((ref, key) => {
      off(ref);
      console.log(`🛑 Stopped listening to ${key}`);
    });
    this.listeners.clear();
    this.currentData = {};
  }

  // Test connection (verify ESP32 data is accessible) - FIXED
  async testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const testRef = ref(realtimeDb, 'sensor/temperature');
      let firstValue: number | null = null;
      let changeDetected = false;
      let unsubscribe: (() => void) | null = null;
      
      const timeout = setTimeout(() => {
        if (unsubscribe) unsubscribe();
        console.log('🧪 Connection test - No data changes detected, device likely offline');
        resolve(changeDetected);
      }, 15000); // Wait 15 seconds for data changes

      unsubscribe = onValue(testRef, (snapshot) => {
        const value = snapshot.val();
        
        if (value !== null && value !== undefined) {
          if (firstValue === null) {
            firstValue = value;
            console.log('🧪 First temperature value:', value);
          } else if (Math.abs(value - firstValue) > 0.1) { // Temperature changed by more than 0.1°C
            console.log('🧪 Temperature change detected:', firstValue, '→', value);
            changeDetected = true;
            
            clearTimeout(timeout);
            if (unsubscribe) unsubscribe();
            resolve(true);
          }
        }
      }, (error) => {
        clearTimeout(timeout);
        console.error('❌ Connection test failed:', error);
        if (unsubscribe) unsubscribe();
        resolve(false);
      });
    });
  }
}

export default IoTRealtimeService;
