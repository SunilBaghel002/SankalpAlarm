// App.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  AppState,
  AppStateStatus,
  View,
  Text,
  StyleSheet,
} from 'react-native';
import AlarmScreen from '../../components/AlarmScreen';
import SetAlarmScreen from '../../components/SetAlarmScreen';
import { AlarmManager, Alarm } from '../../utils/alarmManager';

export default function HomeScreen() {
  const [showAlarm, setShowAlarm] = useState<boolean>(false);
  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const appState = useRef(AppState.currentState);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef<boolean>(false);

  useEffect(() => {
    initializeApp();

    // Handle app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      stopAlarmChecker();
    };
  }, []);

  const initializeApp = async () => {
    console.log('🚀 Initializing app...');

    // Load saved alarm
    const alarm = await AlarmManager.loadAlarm();
    if (alarm && alarm.enabled) {
      setActiveAlarm(alarm);
      console.log('📱 Loaded alarm:', alarm);
    }

    setIsLoading(false);

    // Start checking
    startAlarmChecker();
  };

  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    console.log(`📱 App state: ${appState.current} → ${nextAppState}`);

    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // App came to foreground
      console.log('👀 App came to foreground');
      checkAlarmTime();
    }

    appState.current = nextAppState;
  }, []);

  const startAlarmChecker = () => {
    console.log('⏰ Starting alarm checker (every 10 seconds)...');

    // Clear any existing interval
    stopAlarmChecker();

    // Check immediately
    checkAlarmTime();

    // Then check every 10 seconds
    checkIntervalRef.current = setInterval(() => {
      checkAlarmTime();
    }, 10000);
  };

  const stopAlarmChecker = () => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
  };

  const checkAlarmTime = async () => {
    // Prevent concurrent checks
    if (isCheckingRef.current || showAlarm) {
      return;
    }

    isCheckingRef.current = true;

    try {
      const { shouldTrigger, alarm } = await AlarmManager.shouldTrigger();

      if (shouldTrigger && alarm) {
        console.log('🔔 TRIGGERING ALARM!');

        // Mark as triggered BEFORE showing alarm to prevent re-triggers
        await AlarmManager.markTriggered();

        // Update state
        setActiveAlarm(alarm);
        setShowAlarm(true);
      }
    } catch (error) {
      console.error('Error checking alarm:', error);
    } finally {
      isCheckingRef.current = false;
    }
  };

  const handleTestAlarm = useCallback(() => {
    console.log('🧪 Testing alarm...');
    setShowAlarm(true);
  }, []);

  const handleAlarmChange = useCallback((alarm: Alarm | null) => {
    console.log('📝 Alarm changed:', alarm?.enabled ? 'Enabled' : 'Disabled');
    setActiveAlarm(alarm);
  }, []);

  const handleDismissAlarm = useCallback(async () => {
    console.log('✅ Alarm dismissed by walking!');

    setShowAlarm(false);

    // Log the successful wake-up
    if (activeAlarm) {
      await AlarmManager.logWakeUp(activeAlarm.requiredSteps);
    }
  }, [activeAlarm]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>⏰ Loading...</Text>
      </View>
    );
  }

  if (showAlarm) {
    return (
      <AlarmScreen
        onDismiss={handleDismissAlarm}
        requiredSteps={activeAlarm?.requiredSteps || 10}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <SetAlarmScreen
        onTestAlarm={handleTestAlarm}
        onAlarmChange={handleAlarmChange}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 24,
  },
});