'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import IoTRealtimeService from '@/services/iotRealtimeService';
import { ESP32SensorData, ESP32GPSData, ESP32MPUData } from '@/types/iot';

export const IoTConnectionTest: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sensorData, setSensorData] = useState<ESP32SensorData | null>(null);
  const [gpsData, setGpsData] = useState<ESP32GPSData | null>(null);
  const [mpuData, setMpuData] = useState<ESP32MPUData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const iotService = IoTRealtimeService.getInstance();

  const startTest = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Test connection first
      const connectionOk = await iotService.testConnection();
      
      if (!connectionOk) {
        throw new Error('Cannot connect to ESP32 device');
      }

      // Start real-time listeners
      iotService.startListening({
        onSensorUpdate: (data) => {
          setSensorData(data);
          setLastUpdate(new Date());
          setIsConnected(true);
        },
        onGPSUpdate: (data) => {
          setGpsData(data);
          setLastUpdate(new Date());
        },
        onMPUUpdate: (data) => {
          setMpuData(data);
          setLastUpdate(new Date());
        },
        onError: (err) => {
          setError(err.message);
          setIsConnected(false);
        }
      });

      console.log('✅ IoT Connection Test Started');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const stopTest = () => {
    iotService.stopListening();
    setIsConnected(false);
    setSensorData(null);
    setGpsData(null);
    setMpuData(null);
    setLastUpdate(null);
    console.log('🛑 IoT Connection Test Stopped');
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      iotService.stopListening();
    };
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            ESP32 IoT Connection Test
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Test real-time connection to ESP32 device data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={startTest} 
              disabled={isLoading || isConnected}
              variant="default"
            >
              {isLoading ? "Connecting..." : "Start Test"}
            </Button>
            <Button 
              onClick={stopTest} 
              disabled={!isConnected}
              variant="outline"
            >
              Stop Test
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700 text-sm">❌ Error: {error}</p>
            </div>
          )}

          {lastUpdate && (
            <div className="text-sm text-gray-600">
              Last Update: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sensor Data Display */}
      {sensorData && (
        <Card>
          <CardHeader>
            <CardTitle>Sensor Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-red-50 rounded-lg">
                <div className="text-sm text-gray-600">Temperature</div>
                <div className="text-2xl font-bold text-red-600">
                  {sensorData.temperature?.toFixed(1)}°C
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600">Humidity</div>
                <div className="text-2xl font-bold text-blue-600">
                  {sensorData.humidity?.toFixed(1)}%
                </div>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <div className="text-sm text-gray-600">LPG Gas</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {sensorData.lpg_ppm?.toLocaleString()} PPM
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GPS Data Display */}
      {gpsData && (
        <Card>
          <CardHeader>
            <CardTitle>GPS Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600">Latitude</div>
                <div className="text-lg font-bold text-green-600">
                  {gpsData.latitude?.toFixed(6)}
                </div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600">Longitude</div>
                <div className="text-lg font-bold text-green-600">
                  {gpsData.longitude?.toFixed(6)}
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <div className="text-sm text-gray-600">Speed</div>
                <div className="text-lg font-bold text-purple-600">
                  {gpsData.speed?.toFixed(1)} km/h
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Altitude</div>
                <div className="text-lg font-bold text-gray-600">
                  {gpsData.altitude?.toFixed(1) || 'N/A'} m
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MPU6050 Data Display */}
      {mpuData && (
        <Card>
          <CardHeader>
            <CardTitle>Motion Sensor (MPU6050)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Accelerometer (G-force)</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="text-sm text-gray-600">X-Axis</div>
                    <div className="text-lg font-bold text-orange-600">
                      {mpuData.accel_x?.toFixed(3)}G
                    </div>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="text-sm text-gray-600">Y-Axis</div>
                    <div className="text-lg font-bold text-orange-600">
                      {mpuData.accel_y?.toFixed(3)}G
                    </div>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="text-sm text-gray-600">Z-Axis</div>
                    <div className="text-lg font-bold text-orange-600">
                      {mpuData.accel_z?.toFixed(3)}G
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Gyroscope (°/s)</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-indigo-50 rounded-lg">
                    <div className="text-sm text-gray-600">X-Axis</div>
                    <div className="text-lg font-bold text-indigo-600">
                      {mpuData.gyro_x?.toFixed(3)}°/s
                    </div>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-lg">
                    <div className="text-sm text-gray-600">Y-Axis</div>
                    <div className="text-lg font-bold text-indigo-600">
                      {mpuData.gyro_y?.toFixed(3)}°/s
                    </div>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-lg">
                    <div className="text-sm text-gray-600">Z-Axis</div>
                    <div className="text-lg font-bold text-indigo-600">
                      {mpuData.gyro_z?.toFixed(3)}°/s
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw Data Debug */}
      {(sensorData || gpsData || mpuData) && (
        <Card>
          <CardHeader>
            <CardTitle>Raw Data (Debug)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto">
              {JSON.stringify({
                sensor: sensorData,
                gps: gpsData,
                mpu6050: mpuData
              }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IoTConnectionTest;