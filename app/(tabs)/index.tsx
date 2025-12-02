// App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StatusBar, AppState, AppStateStatus } from 'react-native';
import AlarmScreen from '../../components/AlarmScreen';
import SetAlarmScreen from '../../components/SetAlarmScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Alarm {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
  requiredSteps: number;
  label: string;
  days: number[];
}

export default function HomeScreen() {
  const [showAlarm, setShowAlarm] = useState<boolean>(false);
  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);
  const appState = useRef(AppState.currentState);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check alarm time periodically
    startAlarmChecker();

    // Handle app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [activeAlarm]);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // App came to foreground - check if alarm should ring
      checkAlarmTime();
    }
    appState.current = nextAppState;
  };

  const startAlarmChecker = () => {
    // Check every 30 seconds
    checkIntervalRef.current = setInterval(checkAlarmTime, 30000);
    // Also check immediately
    checkAlarmTime();
  };

  const checkAlarmTime = async () => {
    try {
      const saved = await AsyncStorage.getItem('walkAlarm');
      if (!saved) return;

      const alarm: Alarm = JSON.parse(saved);
      if (!alarm.enabled) return;

      const now = new Date();
      const currentDay = now.getDay();
      
      // Check if today is a scheduled day
      if (!alarm.days.includes(currentDay)) return;

      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Check if it's alarm time (within 1 minute window)
      if (
        currentHour === alarm.hour &&
        currentMinute >= alarm.minute &&
        currentMinute <= alarm.minute + 1
      ) {
        console.log('⏰ ALARM TIME!');
        setActiveAlarm(alarm);
        setShowAlarm(true);
      }
    } catch (error) {
      console.error('Error checking alarm:', error);
    }
  };

  const handleTestAlarm = () => {
    console.log('🧪 Testing alarm...');
    setShowAlarm(true);
  };

  const handleDismissAlarm = async () => {
    console.log('✅ Alarm dismissed!');
    setShowAlarm(false);
    
    // Optionally log wake-up success
    try {
      const wakeUpLog = {
        date: new Date().toISOString(),
        success: true,
      };
      const logs = await AsyncStorage.getItem('wakeUpLogs');
      const logsArray = logs ? JSON.parse(logs) : [];
      logsArray.push(wakeUpLog);
      await AsyncStorage.setItem('wakeUpLogs', JSON.stringify(logsArray));
    } catch (error) {
      console.error('Error logging wake-up:', error);
    }
  };

  if (showAlarm) {
    return (
      <AlarmScreen
        onDismiss={handleDismissAlarm}
        requiredSteps={activeAlarm?.requiredSteps || 10}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <SetAlarmScreen
        onTestAlarm={handleTestAlarm}
        activeAlarm={activeAlarm}
        setActiveAlarm={setActiveAlarm}
      />
    </SafeAreaView>
  );
}