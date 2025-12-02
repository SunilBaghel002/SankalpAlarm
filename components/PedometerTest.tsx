// components/PedometerTest.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Vibration,
    Animated,
    ScrollView,
} from 'react-native';
import { Accelerometer } from 'expo-sensors';

const TARGET_STEPS = 10;

interface AccelerometerData {
    x: number;
    y: number;
    z: number;
}

const PedometerTest: React.FC = () => {
    // Step counting state
    const [stepCount, setStepCount] = useState<number>(0);
    const [isTracking, setIsTracking] = useState<boolean>(false);

    // Accelerometer state
    const [accelerometerData, setAccelerometerData] = useState<AccelerometerData>({
        x: 0,
        y: 0,
        z: 0,
    });
    const [magnitude, setMagnitude] = useState<number>(0);
    const [subscription, setSubscription] = useState<any>(null);

    // Step detection refs (to persist between renders)
    const stepCountRef = useRef<number>(0);
    const lastMagnitudeRef = useRef<number>(0);
    const lastStepTimeRef = useRef<number>(0);
    const magnitudeHistoryRef = useRef<number[]>([]);
    const isAboveThresholdRef = useRef<boolean>(false);

    // Debug info
    const [debugInfo, setDebugInfo] = useState({
        peakDetected: false,
        timeSinceLastStep: 0,
        avgMagnitude: 1,
        threshold: 1.15,
    });

    // Sensitivity setting
    const [sensitivity, setSensitivity] = useState<number>(1.15); // Lower = more sensitive

    // Animation
    const [progressAnim] = useState(new Animated.Value(0));
    const [pulseAnim] = useState(new Animated.Value(1));

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (subscription) {
                subscription.remove();
            }
        };
    }, [subscription]);

    // Animate progress when steps change
    useEffect(() => {
        const progress = Math.min(stepCount / TARGET_STEPS, 1);

        Animated.timing(progressAnim, {
            toValue: progress,
            duration: 200,
            useNativeDriver: false,
        }).start();

        // Vibrate and pulse on each step
        if (stepCount > 0 && isTracking) {
            Vibration.vibrate(100);

            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }),
            ]).start();
        }

        // Check if target reached
        if (stepCount >= TARGET_STEPS && isTracking) {
            handleTargetReached();
        }
    }, [stepCount]);

    const startTracking = () => {
        console.log('🚀 Starting step tracking with accelerometer...');

        // Reset everything
        setStepCount(0);
        stepCountRef.current = 0;
        lastMagnitudeRef.current = 0;
        lastStepTimeRef.current = Date.now();
        magnitudeHistoryRef.current = [];
        isAboveThresholdRef.current = false;

        setIsTracking(true);

        // Set accelerometer update interval (50ms = 20 readings per second)
        Accelerometer.setUpdateInterval(50);

        const sub = Accelerometer.addListener((data) => {
            const { x, y, z } = data;

            // Calculate magnitude (total acceleration)
            const mag = Math.sqrt(x * x + y * y + z * z);

            setAccelerometerData(data);
            setMagnitude(mag);

            // Step detection algorithm
            detectStep(mag);
        });

        setSubscription(sub);
    };

    const detectStep = (currentMagnitude: number) => {
        const now = Date.now();
        const timeSinceLastStep = now - lastStepTimeRef.current;

        // Add to history for averaging
        magnitudeHistoryRef.current.push(currentMagnitude);

        // Keep only last 20 readings (1 second of data)
        if (magnitudeHistoryRef.current.length > 20) {
            magnitudeHistoryRef.current.shift();
        }

        // Calculate average magnitude (baseline)
        const avgMagnitude = magnitudeHistoryRef.current.reduce((a, b) => a + b, 0)
            / magnitudeHistoryRef.current.length;

        // Dynamic threshold based on average
        const threshold = avgMagnitude * sensitivity;

        // Update debug info
        setDebugInfo({
            peakDetected: currentMagnitude > threshold,
            timeSinceLastStep,
            avgMagnitude,
            threshold,
        });

        /*
         * STEP DETECTION LOGIC:
         * 1. Magnitude goes ABOVE threshold (start of step)
         * 2. Then goes BELOW threshold (end of step)
         * 3. Must be at least 250ms since last step (max 4 steps/second)
         * 4. Must be at most 2000ms since last step (otherwise walking stopped)
         */

        // Check if we crossed above threshold
        if (currentMagnitude > threshold && !isAboveThresholdRef.current) {
            isAboveThresholdRef.current = true;
        }

        // Check if we crossed below threshold (completed a step)
        if (currentMagnitude < threshold && isAboveThresholdRef.current) {
            isAboveThresholdRef.current = false;

            // Validate timing
            const minTimeBetweenSteps = 250; // Minimum 250ms between steps
            const maxTimeBetweenSteps = 2000; // Maximum 2s between steps

            if (timeSinceLastStep >= minTimeBetweenSteps) {
                // Valid step detected!
                stepCountRef.current += 1;
                lastStepTimeRef.current = now;

                console.log(`👟 Step ${stepCountRef.current} detected! Magnitude: ${currentMagnitude.toFixed(3)}`);

                // Update state (this triggers re-render)
                setStepCount(stepCountRef.current);
            }
        }

        lastMagnitudeRef.current = currentMagnitude;
    };

    const stopTracking = () => {
        console.log('⏹️ Stopping step tracking...');

        if (subscription) {
            subscription.remove();
            setSubscription(null);
        }

        setIsTracking(false);
    };

    const resetSteps = () => {
        setStepCount(0);
        stepCountRef.current = 0;
        progressAnim.setValue(0);
    };

    const handleTargetReached = () => {
        console.log('🎉 TARGET REACHED!');
        Vibration.vibrate([0, 300, 100, 300, 100, 300]);
        // Don't stop tracking - let user continue if they want
    };

    const adjustSensitivity = (change: number) => {
        const newSensitivity = Math.max(1.05, Math.min(1.5, sensitivity + change));
        setSensitivity(newSensitivity);
    };

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    const getStatusColor = () => {
        if (stepCount >= TARGET_STEPS) return '#22c55e';
        if (isTracking) return '#f97316';
        return '#64748b';
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>🚶 Step Counter</Text>
                <Text style={styles.subtitle}>
                    {isTracking ? 'Walk to count steps!' : 'Tap Start to begin'}
                </Text>
            </View>

            {/* Main Step Counter */}
            <Animated.View
                style={[
                    styles.stepCounterContainer,
                    { transform: [{ scale: pulseAnim }] }
                ]}
            >
                <View style={[styles.stepCircle, { borderColor: getStatusColor() }]}>
                    <Text style={[styles.stepCount, { color: getStatusColor() }]}>
                        {stepCount}
                    </Text>
                    <Text style={styles.stepLabel}>/ {TARGET_STEPS} steps</Text>
                </View>
            </Animated.View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                <View style={styles.progressBackground}>
                    <Animated.View
                        style={[
                            styles.progressFill,
                            {
                                width: progressWidth,
                                backgroundColor: getStatusColor()
                            }
                        ]}
                    />
                </View>
                <Text style={styles.progressText}>
                    {Math.round((stepCount / TARGET_STEPS) * 100)}%
                </Text>
            </View>

            {/* Status Message */}
            <View style={styles.messageContainer}>
                {!isTracking && stepCount === 0 && (
                    <Text style={styles.message}>
                        👆 Tap "Start Walking" and walk around with your phone
                    </Text>
                )}
                {isTracking && stepCount < TARGET_STEPS && (
                    <Text style={styles.messageActive}>
                        🚶 Keep walking! {TARGET_STEPS - stepCount} more steps needed
                    </Text>
                )}
                {stepCount >= TARGET_STEPS && (
                    <Text style={styles.messageSuccess}>
                        🎉 Goal reached! You walked {stepCount} steps! 🎉
                    </Text>
                )}
            </View>

            {/* Control Buttons */}
            <View style={styles.buttonContainer}>
                {!isTracking ? (
                    <TouchableOpacity
                        style={styles.startButton}
                        onPress={startTracking}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>🚶 Start Walking</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={styles.stopButton}
                        onPress={stopTracking}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>⏹️ Stop</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={styles.resetButton}
                    onPress={resetSteps}
                    activeOpacity={0.8}
                >
                    <Text style={styles.resetButtonText}>🔄 Reset</Text>
                </TouchableOpacity>
            </View>

            {/* Sensitivity Adjustment */}
            <View style={styles.sensitivityContainer}>
                <Text style={styles.sectionTitle}>⚙️ Sensitivity Adjustment</Text>
                <Text style={styles.sensitivityNote}>
                    If steps aren't counting, try lowering sensitivity
                </Text>
                <View style={styles.sensitivityControls}>
                    <TouchableOpacity
                        style={styles.sensitivityButton}
                        onPress={() => adjustSensitivity(-0.05)}
                    >
                        <Text style={styles.sensitivityButtonText}>- More Sensitive</Text>
                    </TouchableOpacity>

                    <Text style={styles.sensitivityValue}>
                        {((sensitivity - 1) * 100).toFixed(0)}%
                    </Text>

                    <TouchableOpacity
                        style={styles.sensitivityButton}
                        onPress={() => adjustSensitivity(0.05)}
                    >
                        <Text style={styles.sensitivityButtonText}>+ Less Sensitive</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Live Accelerometer Data */}
            <View style={styles.debugContainer}>
                <Text style={styles.sectionTitle}>📊 Live Sensor Data</Text>

                <View style={styles.sensorGrid}>
                    <View style={styles.sensorItem}>
                        <Text style={styles.sensorLabel}>X</Text>
                        <Text style={styles.sensorValue}>{accelerometerData.x.toFixed(2)}</Text>
                    </View>
                    <View style={styles.sensorItem}>
                        <Text style={styles.sensorLabel}>Y</Text>
                        <Text style={styles.sensorValue}>{accelerometerData.y.toFixed(2)}</Text>
                    </View>
                    <View style={styles.sensorItem}>
                        <Text style={styles.sensorLabel}>Z</Text>
                        <Text style={styles.sensorValue}>{accelerometerData.z.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.sensorItem, styles.sensorItemHighlight]}>
                        <Text style={styles.sensorLabel}>Magnitude</Text>
                        <Text style={[
                            styles.sensorValue,
                            styles.magnitudeValue,
                            debugInfo.peakDetected && styles.peakDetected
                        ]}>
                            {magnitude.toFixed(3)}
                        </Text>
                    </View>
                </View>

                {/* Step Detection Status */}
                <View style={styles.detectionStatus}>
                    <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>Threshold:</Text>
                        <Text style={styles.statusValue}>{debugInfo.threshold.toFixed(3)}</Text>
                    </View>
                    <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>Peak Detected:</Text>
                        <View style={[
                            styles.statusIndicator,
                            debugInfo.peakDetected ? styles.indicatorActive : styles.indicatorInactive
                        ]} />
                    </View>
                    <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>Time Since Last Step:</Text>
                        <Text style={styles.statusValue}>{debugInfo.timeSinceLastStep}ms</Text>
                    </View>
                </View>
            </View>

            {/* Visual Magnitude Indicator */}
            <View style={styles.magnitudeBarContainer}>
                <Text style={styles.sectionTitle}>📈 Movement Intensity</Text>
                <View style={styles.magnitudeBar}>
                    <View
                        style={[
                            styles.magnitudeFill,
                            {
                                width: `${Math.min((magnitude / 2) * 100, 100)}%`,
                                backgroundColor: debugInfo.peakDetected ? '#22c55e' : '#f97316'
                            }
                        ]}
                    />
                    <View
                        style={[
                            styles.thresholdLine,
                            { left: `${(debugInfo.threshold / 2) * 100}%` }
                        ]}
                    />
                </View>
                <View style={styles.magnitudeLabels}>
                    <Text style={styles.magnitudeLabelText}>Still</Text>
                    <Text style={styles.magnitudeLabelText}>Walking</Text>
                    <Text style={styles.magnitudeLabelText}>Running</Text>
                </View>
            </View>

            {/* Instructions */}
            <View style={styles.instructionsContainer}>
                <Text style={styles.sectionTitle}>💡 Tips for Best Results</Text>
                <View style={styles.tipItem}>
                    <Text style={styles.tipNumber}>1</Text>
                    <Text style={styles.tipText}>Hold phone in your hand while walking</Text>
                </View>
                <View style={styles.tipItem}>
                    <Text style={styles.tipNumber}>2</Text>
                    <Text style={styles.tipText}>Walk normally - don't shake the phone</Text>
                </View>
                <View style={styles.tipItem}>
                    <Text style={styles.tipNumber}>3</Text>
                    <Text style={styles.tipText}>If steps don't count, lower sensitivity</Text>
                </View>
                <View style={styles.tipItem}>
                    <Text style={styles.tipNumber}>4</Text>
                    <Text style={styles.tipText}>Watch the green indicator flash on each step</Text>
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Sankalp Alarm - Walk to Wake! 💪
                </Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    content: {
        padding: 20,
        paddingTop: 50,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 16,
        color: '#94a3b8',
    },
    stepCounterContainer: {
        alignItems: 'center',
        marginVertical: 20,
    },
    stepCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#1e293b',
        borderWidth: 6,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#f97316',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    stepCount: {
        fontSize: 72,
        fontWeight: 'bold',
    },
    stepLabel: {
        fontSize: 20,
        color: '#94a3b8',
        marginTop: -5,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    progressBackground: {
        flex: 1,
        height: 16,
        backgroundColor: '#1e293b',
        borderRadius: 8,
        overflow: 'hidden',
        marginRight: 15,
    },
    progressFill: {
        height: '100%',
        borderRadius: 8,
    },
    progressText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
        width: 55,
        textAlign: 'right',
    },
    messageContainer: {
        alignItems: 'center',
        marginBottom: 25,
        minHeight: 50,
        paddingHorizontal: 20,
    },
    message: {
        color: '#94a3b8',
        fontSize: 16,
        textAlign: 'center',
    },
    messageActive: {
        color: '#f97316',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    messageSuccess: {
        color: '#22c55e',
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 15,
        marginBottom: 30,
    },
    startButton: {
        backgroundColor: '#22c55e',
        paddingVertical: 18,
        paddingHorizontal: 35,
        borderRadius: 16,
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    stopButton: {
        backgroundColor: '#ef4444',
        paddingVertical: 18,
        paddingHorizontal: 35,
        borderRadius: 16,
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    resetButton: {
        backgroundColor: '#475569',
        paddingVertical: 18,
        paddingHorizontal: 28,
        borderRadius: 16,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    resetButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    sensitivityContainer: {
        backgroundColor: '#1e293b',
        padding: 20,
        borderRadius: 16,
        marginBottom: 20,
    },
    sectionTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    sensitivityNote: {
        color: '#94a3b8',
        fontSize: 14,
        marginBottom: 15,
    },
    sensitivityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sensitivityButton: {
        backgroundColor: '#334155',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 10,
    },
    sensitivityButtonText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '600',
    },
    sensitivityValue: {
        color: '#f97316',
        fontSize: 24,
        fontWeight: 'bold',
    },
    debugContainer: {
        backgroundColor: '#1e293b',
        padding: 20,
        borderRadius: 16,
        marginBottom: 20,
    },
    sensorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 15,
    },
    sensorItem: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#0f172a',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    sensorItemHighlight: {
        minWidth: '100%',
        borderWidth: 2,
        borderColor: '#f97316',
    },
    sensorLabel: {
        color: '#94a3b8',
        fontSize: 14,
        marginBottom: 5,
    },
    sensorValue: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: 'bold',
        fontFamily: 'monospace',
    },
    magnitudeValue: {
        color: '#f97316',
        fontSize: 28,
    },
    peakDetected: {
        color: '#22c55e',
    },
    detectionStatus: {
        backgroundColor: '#0f172a',
        padding: 15,
        borderRadius: 12,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    statusLabel: {
        color: '#94a3b8',
        fontSize: 14,
    },
    statusValue: {
        color: '#ffffff',
        fontSize: 14,
        fontFamily: 'monospace',
    },
    statusIndicator: {
        width: 20,
        height: 20,
        borderRadius: 10,
    },
    indicatorActive: {
        backgroundColor: '#22c55e',
        shadowColor: '#22c55e',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
    },
    indicatorInactive: {
        backgroundColor: '#475569',
    },
    magnitudeBarContainer: {
        backgroundColor: '#1e293b',
        padding: 20,
        borderRadius: 16,
        marginBottom: 20,
    },
    magnitudeBar: {
        height: 30,
        backgroundColor: '#0f172a',
        borderRadius: 15,
        overflow: 'hidden',
        position: 'relative',
    },
    magnitudeFill: {
        height: '100%',
        borderRadius: 15,
    },
    thresholdLine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: '#ffffff',
    },
    magnitudeLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    magnitudeLabelText: {
        color: '#64748b',
        fontSize: 12,
    },
    instructionsContainer: {
        backgroundColor: '#1e293b',
        padding: 20,
        borderRadius: 16,
        marginBottom: 20,
    },
    tipItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    tipNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#f97316',
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        lineHeight: 28,
        marginRight: 12,
    },
    tipText: {
        color: '#e2e8f0',
        fontSize: 14,
        flex: 1,
    },
    footer: {
        alignItems: 'center',
        marginTop: 10,
    },
    footerText: {
        color: '#64748b',
        fontSize: 14,
    },
});

export default PedometerTest;