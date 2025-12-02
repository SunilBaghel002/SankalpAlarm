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

const StepDetector: React.FC<StepDetectorProps> = ({
    targetSteps,
    onTargetReached,
    onStepCountChange,
    isActive,
}) => {
    const [stepCount, setStepCount] = useState<number>(0);
    const [status, setStatus] = useState<string>('Waiting to start...');
    const [statusType, setStatusType] = useState<'info' | 'warning' | 'success' | 'walking'>('info');
    const [debugInfo, setDebugInfo] = useState({
        magnitude: 0,
        variance: 0,
        avgInterval: 0,
        lastStepTime: 0,
    });

    // Animation
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    // Step detection refs
    const subscriptionRef = useRef<any>(null);
    const stepCountRef = useRef<number>(0);
    const magnitudeHistoryRef = useRef<number[]>([]);
    const stepTimesRef = useRef<number[]>([]);
    const lastStepTimeRef = useRef<number>(0);
    const lastPeakTimeRef = useRef<number>(0);
    const isInStepRef = useRef<boolean>(false);
    const baselineRef = useRef<number>(1);
    const movementBufferRef = useRef<{ x: number, y: number, z: number }[]>([]);

    // Anti-cheat: Track movement patterns
    const peakMagnitudesRef = useRef<number[]>([]);
    const valleyMagnitudesRef = useRef<number[]>([]);

    // Settings - TUNED FOR REAL WALKING
    const SETTINGS = {
        // Step timing
        MIN_STEP_INTERVAL: 280,      // Minimum ms between steps (fast walk)
        MAX_STEP_INTERVAL: 1200,     // Maximum ms between steps (slow walk)
        IDEAL_STEP_INTERVAL: 500,    // Ideal step interval ~500ms

        // Magnitude thresholds
        STEP_THRESHOLD_MULTIPLIER: 1.08, // Lower = more sensitive
        MIN_PEAK_MAGNITUDE: 0.12,    // Minimum magnitude change for a step

        // Anti-cheat
        MIN_STEPS_TO_VALIDATE: 2,    // Need 2 steps to start validating pattern
        MAX_RHYTHM_VARIANCE: 0.6,    // Allow 60% variance in rhythm (walking varies naturally)
        MIN_RHYTHM_VARIANCE: 0.05,   // Minimum variance (too consistent = machine/shaking)

        // Movement analysis
        MOVEMENT_WINDOW: 30,         // Number of samples to analyze
        UPDATE_INTERVAL: 40,         // Accelerometer update interval (ms)
    };

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
            toValue: Math.min(stepCount / targetSteps, 1),
            duration: 200,
            useNativeDriver: false,
        }).start();

        onStepCountChange?.(stepCount);

        if (stepCount >= targetSteps) {
            setStatus('🎉 Target reached! Great job!');
            setStatusType('success');
            onTargetReached();
        }
    }, [stepCount, targetSteps]);

    const startDetection = useCallback(() => {
        console.log('🚀 Starting improved step detection...');

        // Reset everything
        stepCountRef.current = 0;
        setStepCount(0);
        magnitudeHistoryRef.current = [];
        stepTimesRef.current = [];
        lastStepTimeRef.current = 0;
        lastPeakTimeRef.current = 0;
        isInStepRef.current = false;
        baselineRef.current = 1;
        movementBufferRef.current = [];
        peakMagnitudesRef.current = [];
        valleyMagnitudesRef.current = [];

        setStatus('👟 Start walking with your phone');
        setStatusType('info');

        Accelerometer.setUpdateInterval(SETTINGS.UPDATE_INTERVAL);

        subscriptionRef.current = Accelerometer.addListener((data) => {
            processMovement(data);
        });
    }, []);

    const stopDetection = useCallback(() => {
        if (subscriptionRef.current) {
            subscriptionRef.current.remove();
            subscriptionRef.current = null;
        }
    }, []);

    const processMovement = (data: { x: number; y: number; z: number }) => {
        const { x, y, z } = data;
        const now = Date.now();

        // Calculate magnitude (total acceleration)
        const magnitude = Math.sqrt(x * x + y * y + z * z);

        // Store movement data
        movementBufferRef.current.push({ x, y, z });
        if (movementBufferRef.current.length > SETTINGS.MOVEMENT_WINDOW) {
            movementBufferRef.current.shift();
        }

        // Store magnitude history
        magnitudeHistoryRef.current.push(magnitude);
        if (magnitudeHistoryRef.current.length > SETTINGS.MOVEMENT_WINDOW) {
            magnitudeHistoryRef.current.shift();
        }

        // Calculate baseline (average magnitude)
        if (magnitudeHistoryRef.current.length >= 10) {
            baselineRef.current = magnitudeHistoryRef.current.reduce((a, b) => a + b, 0)
                / magnitudeHistoryRef.current.length;
        }

        // Dynamic threshold based on baseline
        const threshold = baselineRef.current * SETTINGS.STEP_THRESHOLD_MULTIPLIER;
        const deviation = magnitude - baselineRef.current;

        // Update debug info
        setDebugInfo({
            magnitude: magnitude,
            variance: calculateRhythmVariance(),
            avgInterval: calculateAverageInterval(),
            lastStepTime: now - lastStepTimeRef.current,
        });

        // Step detection using peak detection
        detectStep(magnitude, threshold, deviation, now);
    };

    const detectStep = (magnitude: number, threshold: number, deviation: number, now: number) => {
        const timeSinceLastStep = now - lastStepTimeRef.current;
        const timeSinceLastPeak = now - lastPeakTimeRef.current;

        // Detect peak (going above threshold)
        if (magnitude > threshold && !isInStepRef.current && deviation > SETTINGS.MIN_PEAK_MAGNITUDE) {
            isInStepRef.current = true;
            lastPeakTimeRef.current = now;
            peakMagnitudesRef.current.push(magnitude);

            if (peakMagnitudesRef.current.length > 10) {
                peakMagnitudesRef.current.shift();
            }
        }

        // Detect valley (coming back down) = step complete
        if (magnitude < threshold && isInStepRef.current) {
            isInStepRef.current = false;

            valleyMagnitudesRef.current.push(magnitude);
            if (valleyMagnitudesRef.current.length > 10) {
                valleyMagnitudesRef.current.shift();
            }

            // Check if this is a valid step
            const peakDuration = now - lastPeakTimeRef.current;

            // Step must have reasonable duration (not just noise)
            if (peakDuration < 50 || peakDuration > 400) {
                return; // Too short or too long for a step
            }

            // Check timing between steps
            if (timeSinceLastStep < SETTINGS.MIN_STEP_INTERVAL) {
                // Too fast - might be shaking
                if (stepTimesRef.current.length >= SETTINGS.MIN_STEPS_TO_VALIDATE) {
                    setStatus('⚠️ Too fast! Walk at a normal pace');
                    setStatusType('warning');
                }
                return;
            }

            // Validate step pattern
            const validation = validateStepPattern(now);

            if (validation.isValid) {
                // Valid step!
                stepCountRef.current += 1;
                setStepCount(stepCountRef.current);

                // Record step time
                stepTimesRef.current.push(now);
                if (stepTimesRef.current.length > 10) {
                    stepTimesRef.current.shift();
                }

                lastStepTimeRef.current = now;

                // Feedback
                Vibration.vibrate(60);
                animatePulse();

                if (validation.isWalking) {
                    setStatus(`🚶 Walking detected! Keep going!`);
                    setStatusType('walking');
                } else {
                    setStatus(`👟 ${targetSteps - stepCountRef.current} more steps needed`);
                    setStatusType('info');
                }

                console.log(`✅ Step ${stepCountRef.current} | Interval: ${timeSinceLastStep}ms`);
            } else {
                setStatus(validation.reason);
                setStatusType('warning');
                console.log(`❌ Step rejected: ${validation.reason}`);
            }
        }
    };

    const validateStepPattern = (now: number): { isValid: boolean; isWalking: boolean; reason: string } => {
        // Not enough steps yet to validate pattern - allow first few steps
        if (stepTimesRef.current.length < SETTINGS.MIN_STEPS_TO_VALIDATE) {
            return { isValid: true, isWalking: false, reason: '' };
        }

        // Calculate rhythm variance
        const variance = calculateRhythmVariance();

        // Check for robotic/mechanical movement (too consistent = shaking machine or deliberate cheating)
        if (variance < SETTINGS.MIN_RHYTHM_VARIANCE && stepTimesRef.current.length >= 4) {
            return {
                isValid: false,
                isWalking: false,
                reason: '⚠️ Movement too robotic! Walk naturally'
            };
        }

        // Check for chaotic movement (too random = random shaking)
        if (variance > SETTINGS.MAX_RHYTHM_VARIANCE && stepTimesRef.current.length >= 4) {
            return {
                isValid: false,
                isWalking: false,
                reason: '⚠️ Inconsistent rhythm! Walk steadily'
            };
        }

        // Check if movement is only vertical (up-down shaking)
        const isOnlyVertical = checkIfOnlyVerticalMovement();
        if (isOnlyVertical && stepTimesRef.current.length >= 3) {
            return {
                isValid: false,
                isWalking: false,
                reason: '⚠️ Walk around, don\'t just shake!'
            };
        }

        // Determine if this is real walking
        const isWalking = variance >= SETTINGS.MIN_RHYTHM_VARIANCE &&
            variance <= SETTINGS.MAX_RHYTHM_VARIANCE &&
            stepTimesRef.current.length >= 3;

        return { isValid: true, isWalking, reason: '' };
    };

    const checkIfOnlyVerticalMovement = (): boolean => {
        if (movementBufferRef.current.length < 10) return false;

        const recentMovement = movementBufferRef.current.slice(-15);

        // Calculate variance in each axis
        const xValues = recentMovement.map(m => m.x);
        const yValues = recentMovement.map(m => m.y);
        const zValues = recentMovement.map(m => m.z);

        const xVariance = calculateVariance(xValues);
        const yVariance = calculateVariance(yValues);
        const zVariance = calculateVariance(zValues);

        const totalVariance = xVariance + yVariance + zVariance;

        if (totalVariance === 0) return false;

        // If Y (vertical) dominates too much, it's probably just up-down shaking
        const yRatio = yVariance / totalVariance;

        // Walking should have movement in multiple axes
        // Shaking up-down has mostly Y movement
        return yRatio > 0.85; // If 85%+ of movement is vertical, likely shaking
    };

    const calculateVariance = (values: number[]): number => {
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    };

    const calculateRhythmVariance = (): number => {
        if (stepTimesRef.current.length < 3) return 0.3; // Default middle variance

        const intervals: number[] = [];
        for (let i = 1; i < stepTimesRef.current.length; i++) {
            intervals.push(stepTimesRef.current[i] - stepTimesRef.current[i - 1]);
        }

        if (intervals.length === 0) return 0.3;

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, int) => sum + Math.abs(int - avgInterval), 0) / intervals.length;

        return variance / avgInterval; // Normalized variance (coefficient of variation)
    };

    const calculateAverageInterval = (): number => {
        if (stepTimesRef.current.length < 2) return 0;

        const intervals: number[] = [];
        for (let i = 1; i < stepTimesRef.current.length; i++) {
            intervals.push(stepTimesRef.current[i] - stepTimesRef.current[i - 1]);
        }

        return intervals.reduce((a, b) => a + b, 0) / intervals.length;
    };

    const animatePulse = () => {
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

    const getStatusColor = () => {
        switch (statusType) {
            case 'success': return '#22c55e';
            case 'warning': return '#f59e0b';
            case 'walking': return '#22c55e';
            default: return '#f97316';
        }
    };

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={styles.container}>
            {/* Step Counter Circle */}
            <Animated.View style={[styles.circleContainer, { transform: [{ scale: pulseAnim }] }]}>
                <View style={[styles.stepCircle, { borderColor: getStatusColor() }]}>
                    <Text style={[styles.stepCount, { color: getStatusColor() }]}>
                        {stepCount}
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
                    {Math.round((stepCount / targetSteps) * 100)}%
                </Text>
            </View>

            {/* Status Message */}
            <View style={[styles.statusBox, { borderColor: getStatusColor() }]}>
                <Text style={[styles.statusText, { color: getStatusColor() }]}>
                    {status}
                </Text>
            </View>

            {/* Debug Info (helpful for testing) */}
            <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>📊 Detection Info</Text>
                <View style={styles.debugGrid}>
                    <View style={styles.debugItem}>
                        <Text style={styles.debugLabel}>Magnitude</Text>
                        <Text style={styles.debugValue}>{debugInfo.magnitude.toFixed(2)}</Text>
                    </View>
                    <View style={styles.debugItem}>
                        <Text style={styles.debugLabel}>Rhythm</Text>
                        <Text style={[
                            styles.debugValue,
                            debugInfo.variance > 0.05 && debugInfo.variance < 0.6
                                ? styles.debugGood
                                : styles.debugBad
                        ]}>
                            {(debugInfo.variance * 100).toFixed(0)}%
                        </Text>
                    </View>
                    <View style={styles.debugItem}>
                        <Text style={styles.debugLabel}>Interval</Text>
                        <Text style={styles.debugValue}>{Math.round(debugInfo.avgInterval)}ms</Text>
                    </View>
                    <View style={styles.debugItem}>
                        <Text style={styles.debugLabel}>Since Last</Text>
                        <Text style={styles.debugValue}>{Math.round(debugInfo.lastStepTime)}ms</Text>
                    </View>
                </View>
            </View>

            {/* Tips */}
            <View style={styles.tipsContainer}>
                <Text style={styles.tipsTitle}>💡 Tips:</Text>
                <Text style={styles.tipText}>• Hold phone naturally while walking</Text>
                <Text style={styles.tipText}>• Walk at a steady, normal pace</Text>
                <Text style={styles.tipText}>• Don't shake - actually walk!</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    circleContainer: {
        marginBottom: 15,
    },
    stepCircle: {
        width: 160,
        height: 160,
        borderRadius: 80,
        borderWidth: 5,
        backgroundColor: '#1e293b',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepCount: {
        fontSize: 52,
        fontWeight: 'bold',
    },
    stepTarget: {
        fontSize: 18,
        color: '#64748b',
        marginTop: -5,
    },
    stepLabel: {
        fontSize: 14,
        color: '#64748b',
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 10,
        marginBottom: 15,
    },
    progressBg: {
        flex: 1,
        height: 12,
        backgroundColor: '#1e293b',
        borderRadius: 6,
        overflow: 'hidden',
        marginRight: 10,
    },
    progressFill: {
        height: '100%',
        borderRadius: 6,
    },
    progressPercent: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
        width: 45,
        textAlign: 'right',
    },
    statusBox: {
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        borderWidth: 1,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 20,
        marginBottom: 15,
        minWidth: '90%',
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    debugContainer: {
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 12,
        width: '100%',
        marginBottom: 10,
    },
    debugTitle: {
        color: '#94a3b8',
        fontSize: 12,
        marginBottom: 8,
        textAlign: 'center',
    },
    debugGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    debugItem: {
        width: '48%',
        backgroundColor: '#0f172a',
        borderRadius: 8,
        padding: 8,
        marginBottom: 6,
        alignItems: 'center',
    },
    debugLabel: {
        color: '#64748b',
        fontSize: 11,
        marginBottom: 2,
    },
    debugValue: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    debugGood: {
        color: '#22c55e',
    },
    debugBad: {
        color: '#f59e0b',
    },
    tipsContainer: {
        width: '100%',
        paddingHorizontal: 5,
    },
    tipsTitle: {
        color: '#94a3b8',
        fontSize: 12,
        marginBottom: 4,
    },
    tipText: {
        color: '#64748b',
        fontSize: 11,
        marginBottom: 2,
    },
});

export default StepDetector;