// utils/alarmManager.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Alarm {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
  requiredSteps: number;
  label: string;
  days: number[];
  lastTriggeredDate: string | null; // Track when alarm last triggered
}

export interface AlarmState {
  isTriggered: boolean;
  triggeredAt: number | null;
}

const ALARM_KEY = "walkAlarm";
const ALARM_STATE_KEY = "alarmState";

export const AlarmManager = {
  // Save alarm settings
  saveAlarm: async (alarm: Alarm): Promise<void> => {
    try {
      await AsyncStorage.setItem(ALARM_KEY, JSON.stringify(alarm));
      console.log("💾 Alarm saved:", alarm);
    } catch (error) {
      console.error("Error saving alarm:", error);
    }
  },

  // Load alarm settings
  loadAlarm: async (): Promise<Alarm | null> => {
    try {
      const saved = await AsyncStorage.getItem(ALARM_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
      return null;
    } catch (error) {
      console.error("Error loading alarm:", error);
      return null;
    }
  },

  // Check if alarm should trigger now
  shouldTrigger: async (): Promise<{
    shouldTrigger: boolean;
    alarm: Alarm | null;
  }> => {
    try {
      const alarm = await AlarmManager.loadAlarm();

      if (!alarm || !alarm.enabled) {
        return { shouldTrigger: false, alarm: null };
      }

      const now = new Date();
      const currentDay = now.getDay();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const todayStr = now.toDateString();

      // Check if today is a scheduled day
      if (!alarm.days.includes(currentDay)) {
        return { shouldTrigger: false, alarm };
      }

      // Check if already triggered today
      if (alarm.lastTriggeredDate === todayStr) {
        return { shouldTrigger: false, alarm };
      }

      // Check if it's the right time (exact match or within 1 minute after)
      const isRightTime =
        currentHour === alarm.hour &&
        (currentMinute === alarm.minute || currentMinute === alarm.minute + 1);

      if (isRightTime) {
        console.log("⏰ Alarm should trigger!");
        return { shouldTrigger: true, alarm };
      }

      return { shouldTrigger: false, alarm };
    } catch (error) {
      console.error("Error checking alarm:", error);
      return { shouldTrigger: false, alarm: null };
    }
  },

  // Mark alarm as triggered today
  markTriggered: async (): Promise<void> => {
    try {
      const alarm = await AlarmManager.loadAlarm();
      if (alarm) {
        alarm.lastTriggeredDate = new Date().toDateString();
        await AsyncStorage.setItem(ALARM_KEY, JSON.stringify(alarm));
        console.log("✅ Alarm marked as triggered for today");
      }
    } catch (error) {
      console.error("Error marking alarm triggered:", error);
    }
  },

  // Reset triggered status (for testing or new day)
  resetTriggeredStatus: async (): Promise<void> => {
    try {
      const alarm = await AlarmManager.loadAlarm();
      if (alarm) {
        alarm.lastTriggeredDate = null;
        await AsyncStorage.setItem(ALARM_KEY, JSON.stringify(alarm));
        console.log("🔄 Alarm triggered status reset");
      }
    } catch (error) {
      console.error("Error resetting alarm status:", error);
    }
  },

  // Calculate time until next alarm
  getTimeUntilAlarm: (
    alarm: Alarm
  ): {
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
  } => {
    const now = new Date();
    const alarmTime = new Date();
    alarmTime.setHours(alarm.hour, alarm.minute, 0, 0);

    // If alarm time has passed today, check for next scheduled day
    if (alarmTime <= now || alarm.lastTriggeredDate === now.toDateString()) {
      // Find next scheduled day
      let daysToAdd = 1;
      const currentDay = now.getDay();

      for (let i = 1; i <= 7; i++) {
        const checkDay = (currentDay + i) % 7;
        if (alarm.days.includes(checkDay)) {
          daysToAdd = i;
          break;
        }
      }

      alarmTime.setDate(alarmTime.getDate() + daysToAdd);
    }

    const diff = alarmTime.getTime() - now.getTime();
    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return { hours, minutes, seconds, totalSeconds };
  },

  // Log wake-up success
  logWakeUp: async (stepsWalked: number): Promise<void> => {
    try {
      const log = {
        date: new Date().toISOString(),
        stepsWalked,
        success: true,
      };

      const existingLogs = await AsyncStorage.getItem("wakeUpLogs");
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      logs.push(log);

      // Keep only last 30 logs
      const trimmedLogs = logs.slice(-30);
      await AsyncStorage.setItem("wakeUpLogs", JSON.stringify(trimmedLogs));

      console.log("📝 Wake-up logged:", log);
    } catch (error) {
      console.error("Error logging wake-up:", error);
    }
  },

  // Get wake-up history
  getWakeUpHistory: async (): Promise<any[]> => {
    try {
      const logs = await AsyncStorage.getItem("wakeUpLogs");
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.error("Error getting wake-up history:", error);
      return [];
    }
  },
};
