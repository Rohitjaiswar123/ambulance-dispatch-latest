'use client';

import React from 'react';
import { IoTDashboard } from '@/components/iot/IoTDashboard';

export default function IoTDashboardPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Rakshak IoT Dashboard
          </h1>
          <p className="text-gray-600">
            Real-time monitoring of ESP32 sensor data with automatic emergency detection
          </p>
        </div>
        
        <IoTDashboard showEmergencyControls={true} />
      </div>
    </div>
  );
}