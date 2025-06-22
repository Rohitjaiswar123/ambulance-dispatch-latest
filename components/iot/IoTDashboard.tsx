'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { LogOut } from 'lucide-react';
import IoTRealtimeService from '@/services/iotRealtimeService';
import SensorHistoryService from '@/services/sensorHistoryService';
import EmergencyDetectionService from '@/services/emergencyDetectionService';
import { ESP32SensorData, ESP32GPSData, ESP32MPUData, EMERGENCY_THRESHOLDS } from '@/types/iot';
import { IoTDebugPanel } from './IoTDebugPanel';

interface IoTDashboardProps {
  showEmergencyControls?: boolean;
}

export const IoTDashboard: React.FC<IoTDashboardProps> = ({ 
  showEmergencyControls = false 
}) => {
  const { logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sensorData, setSensorData] = useState<ESP32SensorData | null>(null);
  const [gpsData, setGpsData] = useState<ESP32GPSData | null>(null);
  const [mpuData, setMpuData] = useState<ESP32MPUData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emergencyAlerts, setEmergencyAlerts] = useState<string[]>([]);
  const [historyEnabled, setHistoryEnabled] = useState(false); // Add toggle for history
  const [lastDataTime, setLastDataTime] = useState<number | null>(null);
  const [isReallyConnected, setIsReallyConnected] = useState(false);

  const iotService = IoTRealtimeService.getInstance();
  const historyService = SensorHistoryService.getInstance();
  const emergencyService = EmergencyDetectionService.getInstance();

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Success",
        description: "Logged out successfully",
      });
      router.push('/');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  const startMonitoring = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Testing ESP32 device connection...');
      const connectionOk = await iotService.testConnection();
      
      if (!connectionOk) {
        throw new Error('ESP32 device is not online or not sending data. Please ensure the device is powered on and connected to WiFi.');
      }

      console.log('✅ ESP32 device detected, starting monitoring...');
      
      iotService.startListening({
        onSensorUpdate: async (data) => {
          setSensorData(data);
          const now = Date.now();
          setLastUpdate(new Date(now));
          setLastDataTime(now);
          
          // Check if this is fresh data (within last 2 minutes)
          const isFresh = now - (lastDataTime || 0) > 5000; // 5 seconds between updates
          setIsReallyConnected(isFresh);
          setIsConnected(true);
          
          await checkEmergencies();
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

      // Test Firestore connection before starting history
      if (historyEnabled) {
        console.log('🔍 Testing Firestore connection for sensor history...');
        const firestoreOk = await historyService.testFirestoreConnection();
        
        if (firestoreOk) {
          historyService.startPeriodicSnapshots(() => iotService.getCurrentData());
          console.log('✅ Sensor history logging enabled');
        } else {
          console.warn('⚠️ Firestore connection failed - continuing without history logging');
          setError('Sensor history disabled due to Firestore permission issues');
        }
      } else {
        console.log('📊 Sensor history disabled - real-time monitoring only');
      }
      
      console.log('✅ ESP32 monitoring started successfully');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsConnected(false);
      console.error('❌ Failed to start ESP32 monitoring:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const stopMonitoring = () => {
    iotService.stopListening();
    historyService.stopPeriodicSnapshots();
    setIsConnected(false);
    setSensorData(null);
    setGpsData(null);
    setMpuData(null);
    setLastUpdate(null);
    setEmergencyAlerts([]);
    console.log('🛑 ESP32 monitoring stopped');
  };

  const checkEmergencies = async () => {
    try {
      const currentData = iotService.getCurrentData();
      const emergencies = await emergencyService.monitorSensorData(currentData);
      
      if (emergencies.length > 0) {
        const alerts = emergencies.map(e => 
          `🚨 ${e.triggerType.toUpperCase()}: ${e.triggerValue.toLocaleString()} (Threshold: ${e.threshold.toLocaleString()})`
        );
        setEmergencyAlerts(prev => [...prev, ...alerts].slice(-5));
        
        alerts.forEach(alert => {
          setTimeout(() => {
            setEmergencyAlerts(prev => [...prev, `✅ Auto-created accident report for: ${alert}`].slice(-5));
          }, 2000);
        });
      }
    } catch (error) {
      console.error('❌ Error checking emergencies:', error);
    }
  };

  const toggleHistoryLogging = async () => {
    if (!historyEnabled) {
      // Test Firestore before enabling
      const firestoreOk = await historyService.testFirestoreConnection();
      if (firestoreOk) {
        setHistoryEnabled(true);
        if (isConnected) {
          historyService.startPeriodicSnapshots(() => iotService.getCurrentData());
        }
        console.log('✅ Sensor history logging enabled');
      } else {
        setError('Cannot enable history logging - Firestore permission denied');
      }
    } else {
      setHistoryEnabled(false);
      historyService.stopPeriodicSnapshots();
      console.log('🛑 Sensor history logging disabled');
    }
  };

  useEffect(() => {
    return () => {
      iotService.stopListening();
      historyService.stopPeriodicSnapshots();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (lastDataTime) {
        const age = Date.now() - lastDataTime;
        const maxAge = 120000; // 2 minutes
        
        if (age > maxAge) {
          console.log('🔴 Data is stale, device likely offline');
          setIsReallyConnected(false);
          setIsConnected(false);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [lastDataTime]);

  const getGasLevelColor = (level: number) => {
    if (level > EMERGENCY_THRESHOLDS.GAS_CRITICAL) return 'bg-red-500';
    if (level > EMERGENCY_THRESHOLDS.GAS_WARNING) return 'bg-orange-500';
    return 'bg-green-500';
  };
  const getTemperatureColor = (temp: number) => {
    if (temp > EMERGENCY_THRESHOLDS.TEMPERATURE_CRITICAL) return 'text-red-600 bg-red-50';
    if (temp > EMERGENCY_THRESHOLDS.TEMPERATURE_WARNING) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const getTemperatureStatus = (temp: number) => {
    if (temp > EMERGENCY_THRESHOLDS.TEMPERATURE_CRITICAL) return "🚨 CRITICAL";
    if (temp > EMERGENCY_THRESHOLDS.TEMPERATURE_WARNING) return "⚠️ WARNING";
    return "✅ Normal";
  };

  const getHumidityStatus = (humidity: number) => {
    return humidity > 80 ? "⚠️ High" : "✅ Normal";
  };

  const getGasStatus = (gasLevel: number) => {
    if (gasLevel > EMERGENCY_THRESHOLDS.GAS_CRITICAL) return "🚨 CRITICAL";
    if (gasLevel > EMERGENCY_THRESHOLDS.GAS_WARNING) return "⚠️ WARNING";
    return "✅ Safe";
  };

  const getCrashStatus = (mpuData: ESP32MPUData) => {
    const totalAcceleration = Math.sqrt(
      Math.pow(mpuData.accel_x, 2) +
      Math.pow(mpuData.accel_y, 2) +
      Math.pow(mpuData.accel_z, 2)
    );
    return totalAcceleration > EMERGENCY_THRESHOLDS.CRASH_ACCELERATION;
  };

  return (
    <div className="space-y-6">
      {/* Debug Panel */}
      <IoTDebugPanel />
      
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>🚑 Rakshak IoT Dashboard - Real ESP32 Device Only</span>
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? "default" : "secondary"}>
                {isConnected ? "🟢 ESP32 Connected" : "🔴 ESP32 Offline"}
              </Badge>
              <Badge variant={historyEnabled ? "default" : "outline"}>
                {historyEnabled ? "📊 History ON" : "📊 History OFF"}
              </Badge>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Real-time monitoring of ESP32 sensor data with automatic emergency detection
            <br />
            <span className="text-sm text-orange-600 font-medium">
              ⚠️ Requires physical ESP32 device to be powered on and connected to WiFi
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={startMonitoring} 
              disabled={isLoading || isConnected}
              variant="default"
            >
              {isLoading ? "🔍 Checking ESP32..." : "🚀 Start ESP32 Monitoring"}
            </Button>
            <Button 
              onClick={stopMonitoring} 
              disabled={!isConnected}
              variant="outline"
            >
              🛑 Stop Monitoring
            </Button>
            <Button 
              onClick={toggleHistoryLogging} 
              disabled={isLoading}
              variant="secondary"
              size="sm"
            >
              {historyEnabled ? "🛑 Disable History" : "📊 Enable History"}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                ❌ {error}
                {error.includes('Firestore') && (
                  <div className="mt-2 text-sm">
                    <strong>Note:</strong> ESP32 real-time monitoring works fine. Only history logging is affected.
                  </div>
                )}
                {error.includes('ESP32') && (
                  <div className="mt-2 text-sm">
                    <strong>Troubleshooting:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Ensure ESP32 device is powered on</li>
                      <li>Check WiFi connection on ESP32</li>
                      <li>Verify ESP32 code is running and uploading data</li>
                      <li>Check Firebase database permissions</li>
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {!isConnected && !isLoading && (
            <Alert>
              <AlertDescription>
                📱 <strong>ESP32 Device Status:</strong> Currently offline
                <br />
                <span className="text-sm text-gray-600">
                  The system will automatically detect when your ESP32 device comes online and starts sending sensor data.
                </span>
                <br />
                <span className="text-xs text-gray-500 mt-1 block">
                  Firebase DB: esp32datatransfertest-default-rtdb.firebaseio.com
                </span>
              </AlertDescription>
            </Alert>
          )}

          {lastUpdate && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-sm text-green-800">
                ✅ <strong>ESP32 Active:</strong> Last data received at {lastUpdate.toLocaleTimeString()}
                {historyEnabled && " (History logging enabled)"}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emergency Alerts */}
      {emergencyAlerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">🚨 Emergency Alerts & Auto-Generated Accidents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {emergencyAlerts.map((alert, index) => (
                <Alert key={index} variant={alert.includes('✅') ? "default" : "destructive"}>
                  <AlertDescription>{alert}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Sensor Data - Only show when ESP32 is connected */}
      {isConnected && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Temperature */}
            {sensorData && (
              <Card>
                <CardHeader>
                  <CardTitle>🌡️ Temperature</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold p-3 rounded-lg ${getTemperatureColor(sensorData.temperature)}`}>
                    {sensorData.temperature.toFixed(1)}°C
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    {getTemperatureStatus(sensorData.temperature)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Critical: {`>${EMERGENCY_THRESHOLDS.TEMPERATURE_CRITICAL}°C`}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Humidity */}
            {sensorData && (
              <Card>
                <CardHeader>
                  <CardTitle>💧 Humidity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600 p-3 bg-blue-50 rounded-lg">
                    {sensorData.humidity.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    {getHumidityStatus(sensorData.humidity)}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gas Level */}
            {sensorData && (
              <Card>
                <CardHeader>
                  <CardTitle>⚠️ Gas Level</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600 mb-3">
                    {sensorData.lpg_ppm.toLocaleString()} PPM
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                    <div 
                      className={`h-4 rounded-full transition-all ${getGasLevelColor(sensorData.lpg_ppm)}`}
                      style={{ width: `${Math.min(100, (sensorData.lpg_ppm / EMERGENCY_THRESHOLDS.GAS_CRITICAL) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {getGasStatus(sensorData.lpg_ppm)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Critical: &gt;{EMERGENCY_THRESHOLDS.GAS_CRITICAL.toLocaleString()} PPM
                  </div>
                </CardContent>
              </Card>
            )}

            {/* GPS Location */}
            {gpsData && (
              <Card>
                <CardHeader>
                  <CardTitle>📍 GPS Location</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm text-gray-600">Lat: </span>
                      <span className="font-mono text-green-600">{gpsData.latitude.toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Lng: </span>
                      <span className="font-mono text-green-600">{gpsData.longitude.toFixed(6)}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Speed: </span>
                      <span className="font-bold text-purple-600">{gpsData.speed.toFixed(1)} km/h</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Altitude: </span>
                      <span className="font-mono">{gpsData.altitude?.toFixed(1) || 'N/A'} m</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Speed */}
            {gpsData && (
              <Card>
                <CardHeader>
                  <CardTitle>🚗 Speed</CardTitle>
                </CardHeader>
                <CardContent>
                <div className="text-3xl font-bold text-purple-600 p-3 bg-purple-50 rounded-lg">
                    {gpsData.speed.toFixed(1)} km/h
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    {gpsData.speed > 80 ? "⚠️ High Speed" : "✅ Normal"}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Motion Sensor (MPU6050) */}
            {mpuData && (
              <Card>
                <CardHeader>
                  <CardTitle>🔄 Motion Sensor</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Accelerometer (G)</h4>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center p-2 bg-orange-50 rounded">
                          <div className="text-gray-600">X</div>
                          <div className="font-medium">{mpuData.accel_x.toFixed(2)}</div>
                        </div>
                        <div className="text-center p-2 bg-orange-50 rounded">
                          <div className="text-gray-600">Y</div>
                          <div className="font-medium">{mpuData.accel_y.toFixed(2)}</div>
                        </div>
                        <div className="text-center p-2 bg-orange-50 rounded">
                          <div className="text-gray-600">Z</div>
                          <div className="font-medium">{mpuData.accel_z.toFixed(2)}</div>
                        </div>
                      </div>
                      {getCrashStatus(mpuData) && (
                        <div className="text-red-600 text-sm mt-2">
                          🚨 High G-force detected!
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Gyroscope (°/s)</h4>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center p-2 bg-indigo-50 rounded">
                          <div className="text-gray-600">X</div>
                          <div className="font-medium">{mpuData.gyro_x.toFixed(2)}</div>
                        </div>
                        <div className="text-center p-2 bg-indigo-50 rounded">
                          <div className="text-gray-600">Y</div>
                          <div className="font-medium">{mpuData.gyro_y.toFixed(2)}</div>
                        </div>
                        <div className="text-center p-2 bg-indigo-50 rounded">
                          <div className="text-gray-600">Z</div>
                          <div className="font-medium">{mpuData.gyro_z.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* System Status */}
            <Card>
              <CardHeader>
                <CardTitle>📊 ESP32 System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>ESP32 Device:</span>
                    <span className="text-green-600">✅ Connected</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Update:</span>
                    <span className="text-gray-600">{lastUpdate?.toLocaleTimeString() || 'Never'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Emergency Alerts:</span>
                    <span className="text-gray-600">{emergencyAlerts.length} Active</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Auto-Detection:</span>
                    <span className="text-green-600">✅ Enabled</span>
                  </div>
                  <div className="flex justify-between">
                    <span>History Logging:</span>
                    <span className={historyEnabled ? "text-green-600" : "text-gray-500"}>
                      {historyEnabled ? "✅ Enabled" : "⚪ Disabled"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Data Source:</span>
                    <span className="text-blue-600">🔌 Real ESP32 Device</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Data Summary - Only when connected */}
          <Card>
            <CardHeader>
              <CardTitle>📈 Real-time ESP32 Data Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {sensorData && (
                  <>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-gray-600">Temperature</div>
                      <div className="font-bold text-lg">{sensorData.temperature.toFixed(1)}°C</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-gray-600">Humidity</div>
                      <div className="font-bold text-lg">{sensorData.humidity.toFixed(1)}%</div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="text-gray-600">Gas Level</div>
                      <div className="font-bold text-lg">{(sensorData.lpg_ppm / 1000000).toFixed(1)}M PPM</div>
                    </div>
                  </>
                )}
                {gpsData && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-gray-600">Speed</div>
                    <div className="font-bold text-lg">{gpsData.speed.toFixed(1)} km/h</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Emergency Thresholds Reference */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-yellow-800">⚠️ Emergency Detection Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-semibold text-red-700">🌡️ Temperature</div>
              <div>Critical: {`>${EMERGENCY_THRESHOLDS.TEMPERATURE_CRITICAL}`}°C</div>
              <div>Warning: {`>${EMERGENCY_THRESHOLDS.TEMPERATURE_WARNING}`}°C</div>
            </div>
            <div>
              <div className="font-semibold text-yellow-700">⚠️ Gas Level</div>
              <div>Critical: {`>${EMERGENCY_THRESHOLDS.GAS_CRITICAL.toLocaleString()}`} PPM</div>
              <div>Warning: {`>${EMERGENCY_THRESHOLDS.GAS_WARNING.toLocaleString()}`} PPM</div>
            </div>
            <div>
              <div className="font-semibold text-orange-700">💥 Crash Detection</div>
              <div>G-Force: {`>${EMERGENCY_THRESHOLDS.CRASH_ACCELERATION}`}G</div>
            </div>
            <div>
              <div className="font-semibold text-purple-700">🚗 Speed Alert</div>
              <div>Sudden Stop: {`<${EMERGENCY_THRESHOLDS.SPEED_SUDDEN_STOP}`} km/h</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Firestore Status Info */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-800">ℹ️ System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2">
            <div>
              <strong>Real-time Data:</strong> ESP32 → Firebase Realtime Database → Dashboard (Working ✅)
            </div>
            <div>
              <strong>History Logging:</strong> Dashboard → Firestore Database (Optional - can be disabled)
            </div>
            <div>
              <strong>Emergency Detection:</strong> Real-time analysis with auto-accident creation (Working ✅)
            </div>
            <div className="text-xs text-gray-600 mt-2">
              Firebase Realtime DB: esp32datatransfertest-default-rtdb.firebaseio.com
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IoTDashboard;
