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
      }

      // Get sensor data around accident time
      const historyService = SensorHistoryService.getInstance();
      const accidentTime = accident.createdAt.toDate();
      const contextData = await historyService.getSensorDataAroundTime(accidentTime, 10, 5);
      setSensorData(contextData);

    } catch (error) {
      console.error('❌ Error loading IoT context:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading IoT context...</div>
        </CardContent>
      </Card>
    );
  }

  if (!emergencyDetection && (!sensorData || (sensorData.before.length === 0 && sensorData.after.length === 0))) {
    return null; // No IoT data available
  }

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🤖 IoT Sensor Context
          {emergencyDetection && (
            <Badge variant="destructive">Auto-Detected</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Emergency Detection Info */}
        {emergencyDetection && (
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <h4 className="font-semibold text-red-800 mb-2">
              🚨 Emergency Auto-Detection
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
                </span>
              </div>
              <div>
                <span className="text-gray-600">Threshold:</span>
                <span className="ml-2 font-medium">
                  {emergencyDetection.threshold.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Detected At:</span>
                <span className="ml-2 font-medium">
                  {emergencyDetection.detectedAt.toDate().toLocaleString()}
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
                <h5 className="font-medium text-blue-800 mb-2">Before Accident (10 min)</h5>
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
                <h5 className="font-medium text-green-800 mb-2">After Accident (5 min)</h5>
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
            <h5 className="font-medium text-yellow-800 mb-2">📸 Emergency Snapshot</h5>
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
      </CardContent>
    </Card>
  );
};

export default AccidentIoTContext;