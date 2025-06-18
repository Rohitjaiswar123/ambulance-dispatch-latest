'use client';

import React from 'react';
import { IoTConnectionTest } from '@/components/iot/IoTConnectionTest';

export default function IoTTestPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            IoT Device Connection Test
          </h1>
          <p className="text-gray-600">
            Test real-time connection to ESP32 sensor data
          </p>
        </div>
        
        <IoTConnectionTest />
      </div>
    </div>
  );
}