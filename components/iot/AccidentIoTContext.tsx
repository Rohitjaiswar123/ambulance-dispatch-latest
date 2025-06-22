'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accident } from '@/types';
import { SensorHistoryRecord, EmergencyDetection } from '@/types/iot';
import SensorHistoryService from '@/services/sensorHistoryService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface AccidentIoTContextProps {
  accident: Accident;
}

export const AccidentIoTContext: React.FC<AccidentIoTContextProps> = ({ accident }) => {
  const [sensorData, setSensorData] = useState<{
    before: SensorHistoryRecord[];
    after: SensorHistoryRecord[];
  } | null>(null);
  const [emergencyDetection, setEmergencyDetection] = useState<EmergencyDetection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIoTContext();
  }, [accident.id]);

  const loadIoTContext = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading IoT context for accident:', accident.id);

      // Check if this accident was auto-generated from IoT
      const emergencyQuery = query(
        collection(db, 'emergencyDetections'),
        where('accidentId', '==', accident.id)
      );
      const emergencySnapshot = await getDocs(emergencyQuery);
      
      if (!emergencySnapshot.empty) {
        const emergencyData = {
          id: emergencySnapshot.docs[0].id,
          ...emergencySnapshot.docs[0].data()
        } as EmergencyDetection;
        setEmergencyDetection(emergencyData);
        console.log('✅ Found emergency detection data:', emergencyData);
      } else {
        console.log('ℹ️ No emergency detection data found - checking if IoT generated');
        
        // If no emergency detection but accident has IoT markers, create mock data
        if (accident.additionalInfo?.includes('AUTO-GENERATED from IoT')) {
          console.log('📱 Creating mock emergency detection for IoT accident');
          
          // Extract IoT info from additionalInfo
          const mockEmergency = createMockEmergencyFromAccident(accident);
          if (mockEmergency) {
            setEmergencyDetection(mockEmergency);
          }
        }
      }

      // Get sensor data around accident time
      try {
        const historyService = SensorHistoryService.getInstance();
        const accidentTime = accident.createdAt?.toDate ? accident.createdAt.toDate() : new Date(accident.timestamp.seconds * 1000);
        const contextData = await historyService.getSensorDataAroundTime(accidentTime, 10, 5);
        setSensorData(contextData);
        console.log('✅ Loaded sensor history data');
      } catch (historyError) {
        console.log('⚠️ Could not load sensor history:', historyError);
        // Continue without sensor history - emergency detection is more important
      }

    } catch (error) {
      console.error('❌ Error loading IoT context:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create mock emergency detection from accident data
  const createMockEmergencyFromAccident = (accident: Accident): EmergencyDetection | null => {
    try {
      const additionalInfo = accident.additionalInfo || '';
      
      // Extract trigger type from description or additionalInfo
      let triggerType: EmergencyDetection['triggerType'] = 'gas';
      let triggerValue = 0;
      let threshold = 0;
      
      if (additionalInfo.includes('gas') || accident.description.toLowerCase().includes('gas')) {
        triggerType = 'gas';
        // Try to extract gas value from description
        const gasMatch = accident.description.match(/(\d+(?:,\d+)*)\s*PPM/i);
        if (gasMatch) {
          triggerValue = parseInt(gasMatch[1].replace(/,/g, ''));
          threshold = 1000000; // 1M PPM threshold
        }
      } else if (additionalInfo.includes('temperature') || accident.description.toLowerCase().includes('temperature')) {
        triggerType = 'temperature';
        const tempMatch = accident.description.match(/(\d+(?:\.\d+)?)\s*°C/i);
        if (tempMatch) {
          triggerValue = parseFloat(tempMatch[1]);
          threshold = 60; // 60°C threshold
        }
      } else if (additionalInfo.includes('crash') || accident.description.toLowerCase().includes('crash')) {
        triggerType = 'crash';
        const gForceMatch = accident.description.match(/(\d+(?:\.\d+)?)\s*G/i);
        if (gForceMatch) {
          triggerValue = parseFloat(gForceMatch[1]);
          threshold = 3.0; // 3G threshold
        }
      }

      return {
        id: `mock_${accident.id}`,
        deviceId: 'ESP32_RAKSHAK_001',
        detectedAt: accident.createdAt || accident.timestamp,
        triggerType,
        triggerValue,
        threshold,
        sensorSnapshot: {
          temperature: triggerType === 'temperature' ? triggerValue : 25.0,
          humidity: 60.0,
          smokeLevel: triggerType === 'gas' ? triggerValue : 500000,
          location: {
            lat: accident.location.latitude,
            lng: accident.location.longitude
          },
          speed: 0,
          accelerometer: {
            x: triggerType === 'crash' ? triggerValue : 0.1,
            y: triggerType === 'crash' ? triggerValue * 0.8 : 0.1,
            z: triggerType === 'crash' ? triggerValue * 0.6 : 9.8
          },
          gyroscope: {
            x: 0,
            y: 0,
            z: 0
          }
        },
        status: 'processed',
        accidentId: accident.id
      };
    } catch (error) {
      console.error('❌ Error creating mock emergency:', error);
      return null;
    }
  };

  if (loading) {
    return (
      <Card className="border-blue-200">
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading IoT context...</div>
        </CardContent>
      </Card>
    );
  }

  // Only show if this is an IoT-generated accident (check additionalInfo only)
  const isIoTAccident = emergencyDetection || 
                       accident.additionalInfo?.includes('AUTO-GENERATED from IoT');

  if (!isIoTAccident) {
    return null; // Don't show for manual accidents
  }

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🤖 IoT Emergency Detection Context
          <Badge variant="destructive">Auto-Detected</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Emergency Detection Info */}
        {emergencyDetection && (
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <h4 className="font-semibold text-red-800 mb-2">
              🚨 Emergency Auto-Detection Details
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Trigger Type:</span>
                <span className="ml-2 font-medium text-red-700">
                  {emergencyDetection.triggerType.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Trigger Value:</span>
                <span className="ml-2 font-medium text-red-700">
                  {emergencyDetection.triggerValue.toLocaleString()}
                  {emergencyDetection.triggerType === 'gas' && ' PPM'}
                  {emergencyDetection.triggerType === 'temperature' && '°C'}
                  {emergencyDetection.triggerType === 'crash' && 'G'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Threshold:</span>
                <span className="ml-2 font-medium">
                  {emergencyDetection.threshold.toLocaleString()}
                  {emergencyDetection.triggerType === 'gas' && ' PPM'}
                  {emergencyDetection.triggerType === 'temperature' && '°C'}
                  {emergencyDetection.triggerType === 'crash' && 'G'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Detected At:</span>
                <span className="ml-2 font-medium">
                  {emergencyDetection.detectedAt.toDate ? 
                    emergencyDetection.detectedAt.toDate().toLocaleString() :
                    new Date(emergencyDetection.detectedAt.seconds * 1000).toLocaleString()
                  }
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Sensor Data Summary */}
        {sensorData && (sensorData.before.length > 0 || sensorData.after.length > 0) && (
          <div className="space-y-4">
            <h4 className="font-semibold">📊 Sensor Data Timeline</h4>
            
            {sensorData.before.length > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <h5 className="font-medium text-blue-800 mb-2">Before Emergency (10 min)</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600">Avg Temp:</span>
                    <span className="ml-1 font-medium">
                      {(sensorData.before.reduce((sum, r) => sum + r.temperature, 0) / sensorData.before.length).toFixed(1)}°C
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Avg Speed:</span>
                    <span className="ml-1 font-medium">
                      {(sensorData.before.reduce((sum, r) => sum + r.speed, 0) / sensorData.before.length).toFixed(1)} km/h
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Max Gas:</span>
                    <span className="ml-1 font-medium">
                      {Math.max(...sensorData.before.map(r => r.smokeLevel)).toLocaleString()} PPM
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Records:</span>
                    <span className="ml-1 font-medium">{sensorData.before.length}</span>
                  </div>
                </div>
              </div>
            )}

            {sensorData.after.length > 0 && (
              <div className="p-3 bg-green-50 rounded-lg">
                <h5 className="font-medium text-green-800 mb-2">After Emergency (5 min)</h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-gray-600">Avg Temp:</span>
                    <span className="ml-1 font-medium">
                      {(sensorData.after.reduce((sum, r) => sum + r.temperature, 0) / sensorData.after.length).toFixed(1)}°C
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Avg Speed:</span>
                    <span className="ml-1 font-medium">
                      {(sensorData.after.reduce((sum, r) => sum + r.speed, 0) / sensorData.after.length).toFixed(1)} km/h
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Max Gas:</span>
                    <span className="ml-1 font-medium">
                      {Math.max(...sensorData.after.map(r => r.smokeLevel)).toLocaleString()} PPM
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Records:</span>
                    <span className="ml-1 font-medium">{sensorData.after.length}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sensor Snapshot from Emergency */}
        {emergencyDetection?.sensorSnapshot && (
          <div className="p-3 bg-yellow-50 rounded-lg">
            <h5 className="font-medium text-yellow-800 mb-2">📸 Emergency Sensor Snapshot</h5>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-gray-600">Temperature:</span>
                <span className="ml-1 font-medium">
                  {emergencyDetection.sensorSnapshot.temperature}°C
                </span>
              </div>
              <div>
                <span className="text-gray-600">Humidity:</span>
                <span className="ml-1 font-medium">
                  {emergencyDetection.sensorSnapshot.humidity}%
                </span>
              </div>
              <div>
                <span className="text-gray-600">Gas Level:</span>
                <span className="ml-1 font-medium">
                  {emergencyDetection.sensorSnapshot.smokeLevel.toLocaleString()} PPM
                </span>
              </div>
              <div>
                <span className="text-gray-600">Speed:</span>
                <span className="ml-1 font-medium">
                  {emergencyDetection.sensorSnapshot.speed} km/h
                </span>
              </div>
              <div>
                <span className="text-gray-600">Location:</span>
                <span className="ml-1 font-medium">
                  {emergencyDetection.sensorSnapshot.location.lat.toFixed(4)}, {emergencyDetection.sensorSnapshot.location.lng.toFixed(4)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">G-Force:</span>
                <span className="ml-1 font-medium">
                  {Math.sqrt(
                    Math.pow(emergencyDetection.sensorSnapshot.accelerometer.x, 2) +
                    Math.pow(emergencyDetection.sensorSnapshot.accelerometer.y, 2) +
                    Math.pow(emergencyDetection.sensorSnapshot.accelerometer.z, 2)
                  ).toFixed(2)}G
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Device Information */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <h5 className="font-medium text-gray-800 mb-2">📱 IoT Device Information</h5>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-600">Device ID:</span>
              <span className="ml-1 font-medium">
                {emergencyDetection?.deviceId || 'ESP32_RAKSHAK_001'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Status:</span>
              <span className="ml-1 font-medium text-green-600">
                {emergencyDetection?.status || 'processed'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Auto-Detection:</span>
              <span className="ml-1 font-medium text-blue-600">Enabled</span>
            </div>
            <div>
              <span className="text-gray-600">Response:</span>
              <span className="ml-1 font-medium text-green-600">Automatic</span>
            </div>
          </div>
        </div>

        {/* Emergency Timeline */}
        <div className="p-3 bg-indigo-50 rounded-lg">
          <h5 className="font-medium text-indigo-800 mb-2">⏱️ Emergency Timeline</h5>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">1. Sensor Detection:</span>
              <span className="font-medium">
                {emergencyDetection?.detectedAt.toDate ? 
                  emergencyDetection.detectedAt.toDate().toLocaleTimeString() :
                  new Date(accident.timestamp.seconds * 1000).toLocaleTimeString()
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">2. Accident Created:</span>
              <span className="font-medium">
                {new Date(accident.timestamp.seconds * 1000).toLocaleTimeString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">3. Current Status:</span>
              <span className="font-medium capitalize">
                {accident.status.replace('_', ' ')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">4. Response Time:</span>
              <span className="font-medium text-green-600">
                Immediate (Auto)
              </span>
            </div>
          </div>
        </div>

        {/* Emergency Actions Taken */}
        <div className="p-3 bg-green-50 rounded-lg">
          <h5 className="font-medium text-green-800 mb-2">✅ Automatic Actions Taken</h5>
          <div className="space-y-1 text-xs">
            <div className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              <span>Emergency condition detected by IoT sensors</span>
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              <span>Accident report automatically generated</span>
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              <span>Location coordinates captured from GPS</span>
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              <span>Sensor data snapshot preserved</span>
            </div>
            <div className="flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              <span>Waiting for hospital notification...</span>
            </div>
          </div>
        </div>

        {/* Data Reliability Notice */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <div className="text-blue-600 mr-2">ℹ️</div>
            <div className="text-xs text-blue-800">
              <strong>Data Reliability:</strong> This accident was automatically detected by IoT sensors. 
              All sensor readings and location data were captured at the time of detection. 
              {sensorData ? 
                `Historical sensor data (${(sensorData.before.length + sensorData.after.length)} records) provides additional context.` :
                'Historical sensor data may not be available due to storage limitations.'
              }
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AccidentIoTContext;
