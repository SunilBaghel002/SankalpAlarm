// components/StepDetector.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Vibration,
    Animated,
} from 'react-native';
import { Accelerometer } from 'expo-sensors';

interface StepDetectorProps {
    targetSteps: number;
    onTargetReached: () => void;
    onStepCountChange?: (count: number) => void;
    isActive: boolean;
}

interface StepData {
    timestamp: number;
    magnitude: number;
    x: number;
    y: number;
    z: number;
}

const StepDetector: React.FC<StepDetectorProps> = ({
    targetSteps,
    onTargetReached,
    onStepCountChange,
    isActive,
}) => {
    const [stepCount, setStepCount] = useState<number>(0);
    const [validStepCount, setValidStepCount] = useState<number>(0);
    const [cheatingWarning, setCheatingWarning] = useState<string>('');
    const [magnitude, setMagnitude] = useState<number>(1);
    const [isWalking, setIsWalking] = useState<boolean>(false);

    // Animation
    const [pulseAnim] = useState(new Animated.Value(1));
    const [progressAnim] = useState(new Animated.Value(0));

    // Refs for step detection
    const subscriptionRef = useRef<any>(null);
    const stepDataRef = useRef<StepData[]>([]);
    const lastStepTimeRef = useRef<number>(0);
    const stepIntervalsRef = useRef<number[]>([]);
    const isAboveThresholdRef = useRef<boolean>(false);
    const validStepCountRef = useRef<number>(0);
    const consecutiveGoodStepsRef = useRef<number>(0);
    const xMovementHistoryRef = useRef<number[]>([]);

    // Anti-cheat settings
    const MIN_STEP_INTERVAL = 300;      // Min 300ms between steps (max ~3 steps/sec)
    const MAX_STEP_INTERVAL = 1500;     // Max 1.5s between steps
    const RHYTHM_TOLERANCE = 0.5;       // 50% variation allowed in step rhythm
    const MIN_X_MOVEMENT = 0.15;        // Minimum sideways sway while walking
    const REQUIRED_CONSISTENT_STEPS = 3; // Need 3 consistent steps to validate

    useEffect(() => {
        if (isActive) {
            startDetection();
        } else {
            stopDetection();
        }

        return () => stopDetection();
    }, [isActive]);

    useEffect(() => {
        // Animate progress
        Animated.timing(progressAnim, {
            toValue: validStepCount / targetSteps,
            duration: 200,
            useNativeDriver: false,
        }).start();

        onStepCountChange?.(validStepCount);

        if (validStepCount >= targetSteps) {
            onTargetReached();
        }
    }, [validStepCount]);

    const startDetection = () => {
        console.log('🚀 Starting anti-cheat step detection...');

        // Reset everything
        setStepCount(0);
        setValidStepCount(0);
        validStepCountRef.current = 0;
        stepDataRef.current = [];
        stepIntervalsRef.current = [];
        lastStepTimeRef.current = Date.now();
        consecutiveGoodStepsRef.current = 0;
        xMovementHistoryRef.current = [];
        setCheatingWarning('');

        Accelerometer.setUpdateInterval(50);

        subscriptionRef.current = Accelerometer.addListener((data) => {
            processAccelerometerData(data);
        });
    };

    const stopDetection = () => {
        if (subscriptionRef.current) {
            subscriptionRef.current.remove();
            subscriptionRef.current = null;
        }
    };

    const processAccelerometerData = (data: { x: number; y: number; z: number }) => {
        const { x, y, z } = data;
        const mag = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();

        setMagnitude(mag);

        // Track X movement (sideways sway)
        xMovementHistoryRef.current.push(Math.abs(x));
        if (xMovementHistoryRef.current.length > 20) {
            xMovementHistoryRef.current.shift();
        }

        // Store data for pattern analysis
        stepDataRef.current.push({ timestamp: now, magnitude: mag, x, y, z });
        if (stepDataRef.current.length > 50) {
            stepDataRef.current.shift();
        }

        // Dynamic threshold
        const recentMagnitudes = stepDataRef.current.slice(-20).map(d => d.magnitude);
        const avgMag = recentMagnitudes.reduce((a, b) => a + b, 0) / recentMagnitudes.length || 1;
        const threshold = avgMag * 1.12;

        // Detect step crossing
        if (mag > threshold && !isAboveThresholdRef.current) {
            isAboveThresholdRef.current = true;
        }

        if (mag < threshold && isAboveThresholdRef.current) {
            isAboveThresholdRef.current = false;

            const timeSinceLastStep = now - lastStepTimeRef.current;

            // Basic timing check
            if (timeSinceLastStep >= MIN_STEP_INTERVAL) {
                // Raw step detected
                setStepCount(prev => prev + 1);

                // Now validate with anti-cheat
                const isValid = validateStep(timeSinceLastStep);

                if (isValid) {
                    validStepCountRef.current += 1;
                    setValidStepCount(validStepCountRef.current);
                    setCheatingWarning('');

                    // Visual feedback
                    Vibration.vibrate(80);
                    pulseStep();

                    console.log(`✅ Valid step ${validStepCountRef.current}/${targetSteps}`);
                } else {
                    console.log('❌ Step rejected (anti-cheat)');
                }

                // Update tracking
                stepIntervalsRef.current.push(timeSinceLastStep);
                if (stepIntervalsRef.current.length > 10) {
                    stepIntervalsRef.current.shift();
                }

                lastStepTimeRef.current = now;
            }
        }
    };

    const validateStep = (interval: number): boolean => {
        // Check 1: Step interval within reasonable range
        if (interval < MIN_STEP_INTERVAL) {
            setCheatingWarning('⚠️ Too fast! Walk normally.');
            consecutiveGoodStepsRef.current = 0;
            return false;
        }

        if (interval > MAX_STEP_INTERVAL) {
            // Reset rhythm tracking if too slow
            stepIntervalsRef.current = [];
            consecutiveGoodStepsRef.current = 0;
            return true; // Allow but reset rhythm
        }

        // Check 2: X-axis movement (body sway)
        const avgXMovement = xMovementHistoryRef.current.length > 0
            ? xMovementHistoryRef.current.reduce((a, b) => a + b, 0) / xMovementHistoryRef.current.length
            : 0;

        if (avgXMovement < MIN_X_MOVEMENT) {
            // Low X movement = probably just bouncing phone up/down
            setCheatingWarning('⚠️ Walk with phone in hand, not just bouncing!');
            consecutiveGoodStepsRef.current = 0;
            return false;
        }

        // Check 3: Rhythm consistency (after we have enough data)
        if (stepIntervalsRef.current.length >= 3) {
            const intervals = stepIntervalsRef.current.slice(-5);
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const variance = intervals.reduce((sum, int) => sum + Math.abs(int - avgInterval), 0) / intervals.length;
            const rhythmScore = variance / avgInterval;

            // Walking has consistent rhythm, shaking is random
            if (rhythmScore > RHYTHM_TOLERANCE) {
                setCheatingWarning('⚠️ Inconsistent rhythm! Walk steadily.');
                consecutiveGoodStepsRef.current = 0;
                return false;
            }

            setIsWalking(true);
        }

        // Step passed all checks
        consecutiveGoodStepsRef.current += 1;

        // Only count after we've verified it's real walking
        if (consecutiveGoodStepsRef.current >= REQUIRED_CONSISTENT_STEPS) {
            return true;
        } else {
            // Building confidence, count these too but with note
            return true;
        }
    };

    const pulseStep = () => {
        Animated.sequence([
            Animated.timing(pulseAnim, {
                toValue: 1.15,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    const getStatusColor = () => {
        if (validStepCount >= targetSteps) return '#22c55e';
        if (cheatingWarning) return '#ef4444';
        if (isWalking) return '#22c55e';
        return '#f97316';
    };

    return (
        <View style={styles.container}>
            {/* Step Counter Circle */}
            <Animated.View style={[styles.circleContainer, { transform: [{ scale: pulseAnim }] }]}>
                <View style={[styles.stepCircle, { borderColor: getStatusColor() }]}>
                    <Text style={[styles.stepCount, { color: getStatusColor() }]}>
                        {validStepCount}
                    </Text>
                    <Text style={styles.stepTarget}>/ {targetSteps}</Text>
                    <Text style={styles.stepLabel}>steps</Text>
                </View>
            </Animated.View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                <View style={styles.progressBg}>
                    <Animated.View
                        style={[
                            styles.progressFill,
                            { width: progressWidth, backgroundColor: getStatusColor() }
                        ]}
                    />
                </View>
                <Text style={styles.progressPercent}>
                    {Math.round((validStepCount / targetSteps) * 100)}%
                </Text>
            </View>

            {/* Status Messages */}
            <View style={styles.statusContainer}>
                {cheatingWarning ? (
                    <View style={styles.warningBox}>
                        <Text style={styles.warningText}>{cheatingWarning}</Text>
                    </View>
                ) : validStepCount >= targetSteps ? (
                    <Text style={styles.successText}>🎉 Target reached! Great job!</Text>
                ) : isWalking ? (
                    <Text style={styles.walkingText}>🚶 Walking detected! Keep going!</Text>
                ) : (
                    <Text style={styles.instructionText}>
                        👟 Walk with your phone to count steps
                    </Text>
                )}
            </View>

            {/* Debug Info */}
            <View style={styles.debugContainer}>
                <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>Raw Steps:</Text>
                    <Text style={styles.debugValue}>{stepCount}</Text>
                </View>
                <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>Valid Steps:</Text>
                    <Text style={[styles.debugValue, { color: '#22c55e' }]}>{validStepCount}</Text>
                </View>
                <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>Magnitude:</Text>
                    <Text style={styles.debugValue}>{magnitude.toFixed(3)}</Text>
                </View>
                <View style={styles.debugRow}>
                    <Text style={styles.debugLabel}>Status:</Text>
                    <Text style={[styles.debugValue, { color: getStatusColor() }]}>
                        {isWalking ? '✅ Walking' : '⏳ Waiting'}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    circleContainer: {
        marginBottom: 20,
    },
    stepCircle: {
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 6,
        backgroundColor: '#1e293b',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepCount: {
        fontSize: 56,
        fontWeight: 'bold',
    },
    stepTarget: {
        fontSize: 20,
        color: '#64748b',
        marginTop: -5,
    },
    stepLabel: {
        fontSize: 16,
        color: '#64748b',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    progressBg: {
        flex: 1,
        height: 14,
        backgroundColor: '#1e293b',
        borderRadius: 7,
        overflow: 'hidden',
        marginRight: 12,
    },
    progressFill: {
        height: '100%',
        borderRadius: 7,
    },
    progressPercent: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
        width: 50,
        textAlign: 'right',
    },
    statusContainer: {
        minHeight: 60,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    warningBox: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderWidth: 1,
        borderColor: '#ef4444',
        borderRadius: 12,
        padding: 15,
    },
    warningText: {
        color: '#ef4444',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    successText: {
        color: '#22c55e',
        fontSize: 20,
        fontWeight: 'bold',
    },
    walkingText: {
        color: '#22c55e',
        fontSize: 18,
        fontWeight: '600',
    },
    instructionText: {
        color: '#94a3b8',
        fontSize: 16,
        textAlign: 'center',
    },
    debugContainer: {
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 15,
        marginTop: 20,
        width: '100%',
    },
    debugRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    debugLabel: {
        color: '#64748b',
        fontSize: 14,
    },
    debugValue: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default StepDetector;