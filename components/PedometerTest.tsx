// components/PedometerTest.tsx
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Vibration,
    Animated,
    Dimensions,
} from 'react-native';
import { Pedometer, Accelerometer } from 'expo-sensors';

const { width } = Dimensions.get('window');
const TARGET_STEPS = 10;

interface AccelerometerData {
    x: number;
    y: number;
    z: number;
}

const PedometerTest: React.FC = () => {
    // Pedometer state
    const [isPedometerAvailable, setIsPedometerAvailable] = useState<string>('checking...');
    const [currentStepCount, setCurrentStepCount] = useState<number>(0);
    const [isTracking, setIsTracking] = useState<boolean>(false);
    const [subscription, setSubscription] = useState<any>(null);

    // Accelerometer state (for debugging)
    const [accelerometerData, setAccelerometerData] = useState<AccelerometerData>({
        x: 0,
        y: 0,
        z: 0,
    });
    const [accelSubscription, setAccelSubscription] = useState<any>(null);

    // Animation
    const [progressAnim] = useState(new Animated.Value(0));
    const [scaleAnim] = useState(new Animated.Value(1));

    // Check pedometer availability on mount
    useEffect(() => {
        checkPedometerAvailability();
        return () => {
            // Cleanup subscriptions
            if (subscription) subscription.remove();
            if (accelSubscription) accelSubscription.remove();
        };
    }, []);

    // Animate progress when steps change
    useEffect(() => {
        const progress = Math.min(currentStepCount / TARGET_STEPS, 1);

        Animated.timing(progressAnim, {
            toValue: progress,
            duration: 300,
            useNativeDriver: false,
        }).start();

        // Vibrate on each step
        if (currentStepCount > 0 && isTracking) {
            Vibration.vibrate(50);

            // Pulse animation
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.1,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }),
            ]).start();
        }

        // Check if target reached
        if (currentStepCount >= TARGET_STEPS && isTracking) {
            handleTargetReached();
        }
    }, [currentStepCount]);

    const checkPedometerAvailability = async () => {
        try {
            const available = await Pedometer.isAvailableAsync();
            setIsPedometerAvailable(available ? 'Yes ✅' : 'No ❌');

            if (!available) {
                console.log('Pedometer not available, will use accelerometer fallback');
            }
        } catch (error) {
            setIsPedometerAvailable('Error checking');
            console.error('Error checking pedometer:', error);
        }
    };

    const startTracking = async () => {
        console.log('Starting step tracking...');
        setIsTracking(true);
        setCurrentStepCount(0);

        // Try native pedometer first
        const pedometerAvailable = await Pedometer.isAvailableAsync();

        if (pedometerAvailable) {
            console.log('Using native pedometer');
            const sub = Pedometer.watchStepCount((result) => {
                console.log('Step detected! Count:', result.steps);
                setCurrentStepCount(result.steps);
            });
            setSubscription(sub);
        } else {
            console.log('Using accelerometer fallback');
            startAccelerometerFallback();
        }

        // Also start accelerometer for debugging
        startAccelerometerDebug();
    };

    const startAccelerometerDebug = () => {
        Accelerometer.setUpdateInterval(100);
        const sub = Accelerometer.addListener((data) => {
            setAccelerometerData(data);
        });
        setAccelSubscription(sub);
    };

    const startAccelerometerFallback = () => {
        // Custom step detection using accelerometer
        let lastMagnitude = 0;
        let stepThreshold = 1.2;
        let lastStepTime = 0;
        let stepCount = 0;

        Accelerometer.setUpdateInterval(50);

        const sub = Accelerometer.addListener((data) => {
            const { x, y, z } = data;
            const magnitude = Math.sqrt(x * x + y * y + z * z);

            const now = Date.now();

            // Detect step: magnitude spike with cooldown
            if (
                magnitude > stepThreshold &&
                lastMagnitude <= stepThreshold &&
                now - lastStepTime > 300 // Minimum 300ms between steps
            ) {
                stepCount++;
                lastStepTime = now;
                setCurrentStepCount(stepCount);
                console.log('Accelerometer step detected:', stepCount);
            }

            lastMagnitude = magnitude;
        });

        setSubscription(sub);
    };

    const stopTracking = () => {
        console.log('Stopping step tracking...');

        if (subscription) {
            subscription.remove();
            setSubscription(null);
        }

        if (accelSubscription) {
            accelSubscription.remove();
            setAccelSubscription(null);
        }

        setIsTracking(false);
    };

    const resetSteps = () => {
        setCurrentStepCount(0);
        progressAnim.setValue(0);
    };

    const handleTargetReached = () => {
        console.log('🎉 Target reached!');
        Vibration.vibrate([0, 200, 100, 200, 100, 200]);
        stopTracking();
    };

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>🚶 Pedometer Test</Text>
                <Text style={styles.subtitle}>Walk to test step detection</Text>
            </View>

            {/* Status Card */}
            <View style={styles.statusCard}>
                <Text style={styles.statusLabel}>Pedometer Available:</Text>
                <Text style={styles.statusValue}>{isPedometerAvailable}</Text>
            </View>

            {/* Main Step Counter */}
            <Animated.View
                style={[
                    styles.stepCounterContainer,
                    { transform: [{ scale: scaleAnim }] }
                ]}
            >
                <View style={styles.stepCircle}>
                    <Text style={styles.stepCount}>{currentStepCount}</Text>
                    <Text style={styles.stepLabel}>/ {TARGET_STEPS} steps</Text>
                </View>
            </Animated.View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                <View style={styles.progressBackground}>
                    <Animated.View
                        style={[
                            styles.progressFill,
                            { width: progressWidth }
                        ]}
                    />
                </View>
                <Text style={styles.progressText}>
                    {Math.round((currentStepCount / TARGET_STEPS) * 100)}%
                </Text>
            </View>

            {/* Status Message */}
            <View style={styles.messageContainer}>
                {!isTracking && currentStepCount === 0 && (
                    <Text style={styles.message}>Tap Start Walking and walk around</Text>
                )}
                {isTracking && currentStepCount < TARGET_STEPS && (
                    <Text style={styles.messageActive}>
                        Keep walking! {TARGET_STEPS - currentStepCount} steps to go 🚶
                    </Text>
                )}
                {currentStepCount >= TARGET_STEPS && (
                    <Text style={styles.messageSuccess}>
                        🎉 Goal reached! Great job! 🎉
                    </Text>
                )}
            </View>

            {/* Control Buttons */}
            <View style={styles.buttonContainer}>
                {!isTracking ? (
                    <TouchableOpacity
                        style={styles.startButton}
                        onPress={startTracking}
                    >
                        <Text style={styles.buttonText}>🚶 Start Walking</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={styles.stopButton}
                        onPress={stopTracking}
                    >
                        <Text style={styles.buttonText}>⏹️ Stop</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={styles.resetButton}
                    onPress={resetSteps}
                >
                    <Text style={styles.resetButtonText}>🔄 Reset</Text>
                </TouchableOpacity>
            </View>

            {/* Debug: Accelerometer Data */}
            <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>📊 Accelerometer Data (Debug)</Text>
                <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>X:</Text>
                    <Text style={styles.debugValue}>{accelerometerData.x.toFixed(3)}</Text>
                </View>
                <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>Y:</Text>
                    <Text style={styles.debugValue}>{accelerometerData.y.toFixed(3)}</Text>
                </View>
                <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>Z:</Text>
                    <Text style={styles.debugValue}>{accelerometerData.z.toFixed(3)}</Text>
                </View>
                <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>Magnitude:</Text>
                    <Text style={styles.debugValue}>
                        {Math.sqrt(
                            accelerometerData.x ** 2 +
                            accelerometerData.y ** 2 +
                            accelerometerData.z ** 2
                        ).toFixed(3)}
                    </Text>
                </View>
            </View>

            {/* Instructions */}
            <View style={styles.instructionsContainer}>
                <Text style={styles.instructionsTitle}>📱 How to test:</Text>
                <Text style={styles.instruction}>1. Tap Start Walking</Text>
                <Text style={styles.instruction}>2. Hold phone in hand or pocket</Text>
                <Text style={styles.instruction}>3. Walk normally (dont shake!)</Text>
                <Text style={styles.instruction}>4. Watch step count increase</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        padding: 20,
        paddingTop: 60,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 16,
        color: '#94a3b8',
    },
    statusCard: {
        backgroundColor: '#1e293b',
        padding: 15,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    statusLabel: {
        color: '#94a3b8',
        fontSize: 16,
    },
    statusValue: {
        color: '#22c55e',
        fontSize: 16,
        fontWeight: 'bold',
    },
    stepCounterContainer: {
        alignItems: 'center',
        marginVertical: 20,
    },
    stepCircle: {
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: '#1e293b',
        borderWidth: 4,
        borderColor: '#f97316',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepCount: {
        fontSize: 64,
        fontWeight: 'bold',
        color: '#f97316',
    },
    stepLabel: {
        fontSize: 18,
        color: '#94a3b8',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    progressBackground: {
        flex: 1,
        height: 12,
        backgroundColor: '#1e293b',
        borderRadius: 6,
        overflow: 'hidden',
        marginRight: 10,
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#22c55e',
        borderRadius: 6,
    },
    progressText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
        width: 50,
        textAlign: 'right',
    },
    messageContainer: {
        alignItems: 'center',
        marginBottom: 20,
        minHeight: 30,
    },
    message: {
        color: '#94a3b8',
        fontSize: 16,
    },
    messageActive: {
        color: '#f97316',
        fontSize: 18,
        fontWeight: 'bold',
    },
    messageSuccess: {
        color: '#22c55e',
        fontSize: 20,
        fontWeight: 'bold',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 15,
        marginBottom: 25,
    },
    startButton: {
        backgroundColor: '#22c55e',
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 12,
    },
    stopButton: {
        backgroundColor: '#ef4444',
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 12,
    },
    resetButton: {
        backgroundColor: '#475569',
        paddingVertical: 15,
        paddingHorizontal: 25,
        borderRadius: 12,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    resetButtonText: {
        color: '#ffffff',
        fontSize: 16,
    },
    debugContainer: {
        backgroundColor: '#1e293b',
        padding: 15,
        borderRadius: 12,
        marginBottom: 15,
    },
    debugTitle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    debugRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    debugLabel: {
        color: '#94a3b8',
        fontSize: 14,
    },
    debugValue: {
        color: '#f97316',
        fontSize: 14,
        fontFamily: 'monospace',
    },
    instructionsContainer: {
        backgroundColor: '#1e293b',
        padding: 15,
        borderRadius: 12,
    },
    instructionsTitle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    instruction: {
        color: '#94a3b8',
        fontSize: 14,
        marginBottom: 5,
    },
});

export default PedometerTest;