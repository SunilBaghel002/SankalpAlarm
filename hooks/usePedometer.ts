// hooks/usePedometer.ts
import { useState, useEffect, useCallback } from "react";
import { Pedometer } from "expo-sensors";

interface PedometerData {
  isPedometerAvailable: boolean;
  currentStepCount: number;
  isTracking: boolean;
  error: string | null;
}

interface UsePedometerReturn extends PedometerData {
  startTracking: () => void;
  stopTracking: () => void;
  resetSteps: () => void;
}

export const usePedometer = (targetSteps: number = 10): UsePedometerReturn => {
  const [isPedometerAvailable, setIsPedometerAvailable] =
    useState<boolean>(false);
  const [currentStepCount, setCurrentStepCount] = useState<number>(0);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [baseSteps, setBaseSteps] = useState<number>(0);

  // Check if pedometer is available on device
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const available = await Pedometer.isAvailableAsync();
        setIsPedometerAvailable(available);

        if (!available) {
          setError("Pedometer is not available on this device");
        }
      } catch (err) {
        setError("Error checking pedometer availability");
        console.error("Pedometer check error:", err);
      }
    };

    checkAvailability();
  }, []);

  // Start tracking steps
  const startTracking = useCallback(() => {
    if (!isPedometerAvailable) {
      setError("Pedometer not available");
      return;
    }

    setIsTracking(true);
    setCurrentStepCount(0);
    setError(null);

    // Get current step count as baseline
    const end = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0); // Start of today

    Pedometer.getStepCountAsync(start, end)
      .then((result) => {
        setBaseSteps(result.steps);
        console.log("Base steps set to:", result.steps);
      })
      .catch((err) => {
        console.log("Could not get base steps, starting from 0");
        setBaseSteps(0);
      });

    // Subscribe to step updates
    const sub = Pedometer.watchStepCount((result) => {
      console.log("Raw step count:", result.steps);
      setCurrentStepCount(result.steps);
    });

    setSubscription(sub);
  }, [isPedometerAvailable]);

  // Stop tracking steps
  const stopTracking = useCallback(() => {
    if (subscription) {
      subscription.remove();
      setSubscription(null);
    }
    setIsTracking(false);
  }, [subscription]);

  // Reset step count
  const resetSteps = useCallback(() => {
    setCurrentStepCount(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [subscription]);

  return {
    isPedometerAvailable,
    currentStepCount,
    isTracking,
    error,
    startTracking,
    stopTracking,
    resetSteps,
  };
};
