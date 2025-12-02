// components/AlarmScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    BackHandler,
    StatusBar,
} from 'react-native';
import { Audio } from 'expo-av';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import StepDetector from './StepDetector';

const { width, height } = Dimensions.get('window');

interface AlarmScreenProps {
    onDismiss: () => void;
    requiredSteps?: number;
}

const AlarmScreen: React.FC<AlarmScreenProps> = ({
    onDismiss,
    requiredSteps = 10
}) => {
    const [currentTime, setCurrentTime] = useState<string>('');
    const [stepCount, setStepCount] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState<boolean>(true);
    const soundRef = useRef<Audio.Sound | null>(null);

    useEffect(() => {
        // Keep screen awake
        activateKeepAwakeAsync();

        // Prevent back button
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            // Block back button - must walk to dismiss!
            return true;
        });

        // Start alarm sound
        playAlarmSound();

        // Update time
        updateTime();
        const interval = setInterval(updateTime, 1000);

        return () => {
            backHandler.remove();
            stopAlarmSound();
            deactivateKeepAwake();
            clearInterval(interval);
        };
    }, []);

    const updateTime = () => {
        const now = new Date();
        setCurrentTime(
            now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            })
        );
    };

    const playAlarmSound = async () => {
        try {
            // Configure audio
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                staysActiveInBackground: true,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: false,
                playThroughEarpieceAndroid: false,
            });

            // Use built-in system sound or create a beeping pattern
            const { sound } = await Audio.Sound.createAsync(
                // You can replace this with your own alarm.mp3 in assets folder
                { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
                {
                    isLooping: true,
                    volume: 1.0,
                    shouldPlay: true,
                }
            );

            soundRef.current = sound;
            setIsPlaying(true);

            console.log('🔔 Alarm sound playing');
        } catch (error) {
            console.error('Error playing alarm:', error);
            // Fallback: Use vibration pattern
            startVibrationPattern();
        }
    };

    const startVibrationPattern = () => {
        // Continuous vibration pattern as fallback
        const pattern = [0, 500, 200, 500, 200, 500];
        // Note: This won't loop automatically on all devices
    };

    const stopAlarmSound = async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
                soundRef.current = null;
                setIsPlaying(false);
                console.log('🔕 Alarm sound stopped');
            } catch (error) {
                console.error('Error stopping alarm:', error);
            }
        }
    };

    const handleTargetReached = () => {
        console.log('🎉 Walk target reached! Dismissing alarm...');
        stopAlarmSound();

        // Small delay before dismissing for celebration
        setTimeout(() => {
            onDismiss();
        }, 1500);
    };

    const handleStepCountChange = (count: number) => {
        setStepCount(count);
    };

    return (
        <View style={styles.container}>
            <StatusBar hidden />

            {/* Background Gradient Effect */}
            <View style={styles.gradientBg} />

            {/* Alarm Icon Animation */}
            <View style={styles.alarmIconContainer}>
                <Text style={styles.alarmIcon}>⏰</Text>
                <View style={styles.pulseRing} />
            </View>

            {/* Current Time */}
            <Text style={styles.timeText}>{currentTime}</Text>

            {/* Wake Up Message */}
            <View style={styles.messageContainer}>
                <Text style={styles.wakeUpText}>WAKE UP!</Text>
                <Text style={styles.subMessage}>
                    Walk {requiredSteps} steps to turn off the alarm
                </Text>
            </View>

            {/* Step Detector */}
            <View style={styles.stepDetectorContainer}>
                <StepDetector
                    targetSteps={requiredSteps}
                    onTargetReached={handleTargetReached}
                    onStepCountChange={handleStepCountChange}
                    isActive={true}
                />
            </View>

            {/* Encouragement */}
            <View style={styles.encouragementContainer}>
                {stepCount === 0 && (
                    <Text style={styles.encouragementText}>
                        🚶 Get up and start walking!
                    </Text>
                )}
                {stepCount > 0 && stepCount < requiredSteps && (
                    <Text style={styles.encouragementText}>
                        💪 Keep going! {requiredSteps - stepCount} more steps!
                    </Text>
                )}
                {stepCount >= requiredSteps && (
                    <Text style={styles.successText}>
                        🎉 Great job! You're awake!
                    </Text>
                )}
            </View>

            {/* Cannot Dismiss Warning */}
            <View style={styles.warningContainer}>
                <Text style={styles.warningText}>
                    🔒 This alarm cannot be dismissed without walking
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    gradientBg: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#0f172a',
    },
    alarmIconContainer: {
        position: 'relative',
        marginBottom: 20,
    },
    alarmIcon: {
        fontSize: 80,
    },
    pulseRing: {
        position: 'absolute',
        top: -20,
        left: -20,
        right: -20,
        bottom: -20,
        borderRadius: 100,
        borderWidth: 3,
        borderColor: '#f97316',
        opacity: 0.5,
    },
    timeText: {
        fontSize: 64,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 10,
    },
    messageContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },
    wakeUpText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#f97316',
        letterSpacing: 4,
        marginBottom: 10,
    },
    subMessage: {
        fontSize: 18,
        color: '#94a3b8',
        textAlign: 'center',
    },
    stepDetectorContainer: {
        width: '100%',
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
    },
    encouragementContainer: {
        minHeight: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    encouragementText: {
        fontSize: 18,
        color: '#f97316',
        fontWeight: '600',
    },
    successText: {
        fontSize: 24,
        color: '#22c55e',
        fontWeight: 'bold',
    },
    warningContainer: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderRadius: 12,
        padding: 15,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    warningText: {
        color: '#fca5a5',
        fontSize: 14,
        textAlign: 'center',
    },
});

export default AlarmScreen;