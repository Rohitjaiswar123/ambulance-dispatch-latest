import { Timestamp } from 'firebase/firestore';

// ESP32 Device Constants
export const IOT_DEVICE = {
  ID: 'ESP32_RAKSHAK_001',
  NAME: 'Rakshak Emergency Sensor',
  LOCATION: 'Vehicle Mounted',
  ASSIGNED_USER: 'hsinghjayesh@gmail.com', // Your email
  ASSIGNED_USER_ID: 'USER_ID_FOR_HSINGHJAYESH', // We'll get this dynamically
  CONTACT_NUMBER: '+91-9876543210'
};

// ESP32 Real-time Data Structure (matches your Rakshak app.js)
export interface ESP32SensorData {
  temperature: number;
  humidity: number;
  lpg_ppm: number;
}

export interface ESP32GPSData {
  latitude: number;
  longitude: number;
  speed: number;
  altitude?: number;
  satellites?: number;
}

export interface ESP32MPUData {
  accel_x: number;
  accel_y: number;
  accel_z: number;
  gyro_x: number;
  gyro_y: number;
  gyro_z: number;
  temp: number;
}

// Complete ESP32 Data Structure
export interface ESP32Data {
  sensor: ESP32SensorData;
  gps: ESP32GPSData;
  mpu6050: ESP32MPUData;
  timestamp?: number;
}

// Sensor History Document (Firestore)
export interface SensorHistoryRecord {
  id?: string;
  deviceId: string;
  recordedAt: Timestamp;
  temperature: number;
  humidity: number;
  smokeLevel: number; // lpg_ppm
  location: {
    lat: number;
    lng: number;
  };
  speed: number;
  accelerometer: {
    x: number;
    y: number;
    z: number;
  };
  gyroscope: {
    x: number;
    y: number;
    z: number;
  };
  isTemplate?: boolean;
}

// Emergency Detection Document (Firestore)
export interface EmergencyDetection {
  id?: string;
  deviceId: string;
  detectedAt: Timestamp;
  triggerType: 'gas' | 'temperature' | 'crash' | 'speed' | 'gps';
  triggerValue: number;
  threshold: number;
  accidentId?: string;
  sensorSnapshot: Omit<SensorHistoryRecord, 'id' | 'deviceId' | 'recordedAt'>;
  status: 'detected' | 'processed' | 'resolved';
}

// Emergency Thresholds
export const EMERGENCY_THRESHOLDS = {
  GAS_CRITICAL: 10000000, // 10M PPM (based on your current 285M+ readings)
  GAS_WARNING: 5000000,   // 5M PPM
  TEMPERATURE_CRITICAL: 60, // 60°C
  TEMPERATURE_WARNING: 45,  // 45°C
  SPEED_SUDDEN_STOP: 20,    // 20 km/h drop in 5 seconds
  CRASH_ACCELERATION: 3.0,  // 3G force
} as const;

// Chart Data Types (for React components)
export interface ChartDataPoint {
  time: string;
  value: number;
}

export interface IoTDashboardData {
  temperature: ChartDataPoint[];
  humidity: ChartDataPoint[];
  gasLevel: number;
  currentLocation: {
    lat: number;
    lng: number;
  };
  speed: number;
  lastUpdate: Date;
}