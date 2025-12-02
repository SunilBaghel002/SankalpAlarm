// components/AlarmScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    BackHandler,
    StatusBar,
    Animated,
} from 'react-native';
import { Audio } from 'expo-av';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import StepDetector from './StepDetector';

interface AlarmScreenProps {
    onDismiss: () => void;
    requiredSteps?: number;
}

const AlarmScreen: React.FC<AlarmScreenProps> = ({
    onDismiss,
    requiredSteps = 10,
}) => {
    const [currentTime, setCurrentTime] = useState<string>('');
    const [stepCount, setStepCount] = useState<number>(0);
    const [isComplete, setIsComplete] = useState<boolean>(false);

    const soundRef = useRef<Audio.Sound | null>(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        console.log('🔔 Alarm screen mounted');

        // Keep screen awake
        activateKeepAwakeAsync();

        // Prevent back button
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            console.log('⛔ Back button blocked');
            return true; // Block back button
        });

        // Start alarm sound
        playAlarmSound();

        // Update time every second
        updateTime();
        const timeInterval = setInterval(updateTime, 1000);

        // Start pulse animation
        startPulseAnimation();

        return () => {
            console.log('🔔 Alarm screen unmounting');
            backHandler.remove();
            stopAlarmSound();
            deactivateKeepAwake();
            clearInterval(timeInterval);
        };
    }, []);

    const startPulseAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    const updateTime = () => {
        const now = new Date();
        setCurrentTime(
            now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
            })
        );
    };

    const playAlarmSound = async () => {
        try {
            console.log('🔊 Setting up audio...');

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                staysActiveInBackground: true,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: false,
                playThroughEarpieceAndroid: false,
            });

            // Using a reliable alarm sound URL
            const { sound } = await Audio.Sound.createAsync(
                { uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3' },
                {
                    isLooping: true,
                    volume: 1.0,
                    shouldPlay: true,
                }
            );

            soundRef.current = sound;
            console.log('🔊 Alarm sound playing');
        } catch (error) {
            console.error('Error playing alarm sound:', error);
            // Sound failed, but alarm still works with visual
        }
    };

    const stopAlarmSound = async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
                soundRef.current = null;
                console.log('🔕 Alarm sound stopped');
            } catch (error) {
                console.error('Error stopping sound:', error);
            }
        }
    };

    const handleTargetReached = async () => {
        console.log('🎉 Walk target reached!');
        setIsComplete(true);

        // Stop the alarm sound
        await stopAlarmSound();

        // Wait a moment to show success, then dismiss
        setTimeout(() => {
            onDismiss();
        }, 2000);
    };

    const handleStepCountChange = (count: number) => {
        setStepCount(count);
    };

    return (
        <View style={styles.container}>
            <StatusBar hidden />

            {/* Animated Alarm Icon */}
            <Animated.View
                style={[
                    styles.alarmIconContainer,
                    { transform: [{ scale: pulseAnim }] }
                ]}
            >
                <Text style={styles.alarmIcon}>⏰</Text>
            </Animated.View>

            {/* Current Time */}
            <Text style={styles.timeText}>{currentTime}</Text>

            {/* Wake Up Message */}
            <View style={styles.messageContainer}>
                {isComplete ? (
                    <>
                        <Text style={styles.successText}>🎉 GREAT JOB! 🎉</Text>
                        <Text style={styles.successSubtext}>You're awake! Have a great day!</Text>
                    </>
                ) : (
                    <>
                        <Text style={styles.wakeUpText}>WAKE UP!</Text>
                        <Text style={styles.subMessage}>
                            Walk {requiredSteps} steps to turn off the alarm
                        </Text>
                    </>
                )}
            </View>

            {/* Step Detector */}
            {!isComplete && (
                <View style={styles.stepDetectorContainer}>
                    <StepDetector
                        targetSteps={requiredSteps}
                        onTargetReached={handleTargetReached}
                        onStepCountChange={handleStepCountChange}
                        isActive={true}
                    />
                </View>
            )}

            {/* Warning */}
            {!isComplete && (
                <View style={styles.warningContainer}>
                    <Text style={styles.warningText}>
                        🔒 Walk {requiredSteps - stepCount} more steps to dismiss
                    </Text>
                    <Text style={styles.warningSubtext}>
                        Back button is disabled • Cannot close app
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 60,
        paddingHorizontal: 20,
    },
    alarmIconContainer: {
        marginBottom: 15,
    },
    alarmIcon: {
        fontSize: 70,
    },
    timeText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 10,
    },
    messageContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    wakeUpText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#f97316',
        letterSpacing: 3,
        marginBottom: 8,
    },
    subMessage: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
    },
    successText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#22c55e',
        marginBottom: 10,
    },
    successSubtext: {
        fontSize: 18,
        color: '#86efac',
    },
    stepDetectorContainer: {
        width: '100%',
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        borderRadius: 20,
        padding: 15,
        marginBottom: 15,
    },
    warningContainer: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderRadius: 12,
        padding: 15,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        alignItems: 'center',
    },
    warningText: {
        color: '#fca5a5',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    warningSubtext: {
        color: '#f87171',
        fontSize: 12,
    },
});

export default AlarmScreen;