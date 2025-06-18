'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import IoTRealtimeService from '@/services/iotRealtimeService';

interface DebugData {
  sensor?: any;
  gps?: any;
  mpu?: any;
}

export const IoTDebugPanel: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('disconnected');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const iotService = IoTRealtimeService.getInstance();

  const startDebugListening = async () => {
    setConnectionStatus('checking');
    
    try {
      // Test connection first
      const isConnected = await iotService.testConnection();
      
      if (!isConnected) {
        setConnectionStatus('disconnected');
        return;
      }

      setIsListening(true);
      setConnectionStatus('connected');
      
      iotService.startListening({
        onSensorUpdate: (data) => {
          setDebugData((prev: DebugData | null) => ({ ...prev, sensor: data }));
          setLastUpdate(new Date());
          console.log('🔍 Debug - Sensor data:', data);
        },
        onGPSUpdate: (data) => {
          setDebugData((prev: DebugData | null) => ({ ...prev, gps: data }));
          setLastUpdate(new Date());
          console.log('🔍 Debug - GPS data:', data);
        },
        onMPUUpdate: (data) => {
          setDebugData((prev: DebugData | null) => ({ ...prev, mpu: data }));
          setLastUpdate(new Date());
          console.log('🔍 Debug - MPU data:', data);
        },
        onError: (error) => {
          console.error('🔍 Debug - Error:', error);
          setConnectionStatus('disconnected');
        }
      });
    } catch (error) {
      console.error('🔍 Debug - Connection failed:', error);
      setConnectionStatus('disconnected');
    }
  };

  const stopDebugListening = () => {
    iotService.stopListening();
    setIsListening(false);
    setConnectionStatus('disconnected');
    setDebugData(null);
    setLastUpdate(null);
  };

  const checkESP32Status = async () => {
    setConnectionStatus('checking');
    
    try {
      const isOnline = await iotService.testConnection();
      setConnectionStatus(isOnline ? 'connected' : 'disconnected');
      
      if (isOnline) {
        const currentData = iotService.getCurrentData();
        setDebugData(currentData);
        console.log('✅ ESP32 is online, current data:', currentData);
      } else {
        console.log('❌ ESP32 is offline');
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      console.error('❌ ESP32 status check failed:', error);
    }
  };

  useEffect(() => {
    // Auto-check ESP32 status every 30 seconds
    const interval = setInterval(() => {
      if (!isListening) {
        checkESP32Status();
      }
    }, 30000);

    // Initial check
    checkESP32Status();

    return () => {
      clearInterval(interval);
      if (isListening) {
        iotService.stopListening();
      }
    };
  }, [isListening]);

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge className="bg-green-500">🟢 ESP32 Online</Badge>;
      case 'disconnected':
        return <Badge className="bg-red-500">🔴 ESP32 Offline</Badge>;
      case 'checking':
        return <Badge className="bg-yellow-500">🟡 Checking...</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <Card className="border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          🔍 ESP32 Debug Panel
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={startDebugListening} 
            disabled={isListening || connectionStatus === 'checking'}
            size="sm"
          >
            Start Debug Listening
          </Button>
          <Button 
            onClick={stopDebugListening} 
            disabled={!isListening}
            variant="outline"
            size="sm"
          >
            Stop Debug
          </Button>
          <Button 
            onClick={checkESP32Status} 
            disabled={connectionStatus === 'checking'}
            variant="secondary"
            size="sm"
          >
            Check ESP32 Status
          </Button>
        </div>

        {connectionStatus === 'disconnected' && !isListening && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-semibold text-red-800 mb-2">❌ No data received from ESP32. Check:</h4>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• ESP32 is powered on and connected to WiFi</li>
              <li>• ESP32 code is running and sending data</li>
              <li>• Firebase Realtime Database URL is correct</li>
              <li>• ESP32 has write permissions to Firebase</li>
              <li>• Network connection is stable</li>
            </ul>
          </div>
        )}

        {connectionStatus === 'connected' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-800 mb-2">✅ ESP32 Device Online</h4>
            <p className="text-sm text-green-700">
              ESP32 is connected and sending data to Firebase Realtime Database
            </p>
            {lastUpdate && (
              <p className="text-xs text-green-600 mt-1">
                Last update: {lastUpdate.toLocaleTimeString()}
              </p>
            )}
          </div>
        )}

        {debugData && (
          <div className="bg-gray-50 border rounded-lg p-4">
            <h4 className="font-semibold mb-2">📊 Latest ESP32 Data:</h4>
            <pre className="text-xs bg-white p-2 rounded border overflow-auto max-h-40">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          </div>
        )}

        <div className="text-xs text-gray-500">
          Firebase DB: esp32datatransfertest-default-rtdb.firebaseio.com
          <br />
          Auto-checking ESP32 status every 30 seconds
        </div>
      </CardContent>
    </Card>
  );
};
