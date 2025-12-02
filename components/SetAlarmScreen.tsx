// components/SetAlarmScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    Alert,
} from 'react-native';
import { AlarmManager, Alarm } from '../utils/alarmManager';

interface SetAlarmScreenProps {
    onTestAlarm: () => void;
    onAlarmChange: (alarm: Alarm | null) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STEP_OPTIONS = [10, 15, 20, 30, 50];

const SetAlarmScreen: React.FC<SetAlarmScreenProps> = ({
    onTestAlarm,
    onAlarmChange,
}) => {
    const [hour, setHour] = useState<number>(6);
    const [minute, setMinute] = useState<number>(0);
    const [enabled, setEnabled] = useState<boolean>(false);
    const [requiredSteps, setRequiredSteps] = useState<number>(10);
    const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
    const [timeUntil, setTimeUntil] = useState<{ hours: number; minutes: number; seconds: number }>({
        hours: 0,
        minutes: 0,
        seconds: 0,
    });
    const [lastTriggeredDate, setLastTriggeredDate] = useState<string | null>(null);

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        loadAlarm();
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (enabled && selectedDays.length > 0) {
            updateTimeUntil();
            timerRef.current = setInterval(updateTimeUntil, 1000);
        } else {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [enabled, hour, minute, selectedDays, lastTriggeredDate]);

    const loadAlarm = async () => {
        const alarm = await AlarmManager.loadAlarm();
        if (alarm) {
            setHour(alarm.hour);
            setMinute(alarm.minute);
            setEnabled(alarm.enabled);
            setRequiredSteps(alarm.requiredSteps);
            setSelectedDays(alarm.days);
            setLastTriggeredDate(alarm.lastTriggeredDate);

            if (alarm.enabled) {
                onAlarmChange(alarm);
            }
        }
    };

    const updateTimeUntil = () => {
        const alarm: Alarm = {
            id: 'main',
            hour,
            minute,
            enabled,
            requiredSteps,
            label: 'Wake Up',
            days: selectedDays,
            lastTriggeredDate,
        };

        const time = AlarmManager.getTimeUntilAlarm(alarm);
        setTimeUntil(time);
    };

    const saveAlarm = async () => {
        if (selectedDays.length === 0) {
            Alert.alert('No Days Selected', 'Please select at least one day for the alarm.');
            return;
        }

        const alarm: Alarm = {
            id: 'main',
            hour,
            minute,
            enabled,
            requiredSteps,
            label: 'Wake Up',
            days: selectedDays,
            lastTriggeredDate: enabled ? lastTriggeredDate : null,
        };

        await AlarmManager.saveAlarm(alarm);
        onAlarmChange(enabled ? alarm : null);

        if (enabled) {
            const time = AlarmManager.getTimeUntilAlarm(alarm);
            Alert.alert(
                '⏰ Alarm Set!',
                `Alarm will ring in ${time.hours}h ${time.minutes}m ${time.seconds}s\n\nYou'll need to walk ${requiredSteps} steps to dismiss it.`,
                [{ text: 'OK' }]
            );
        } else {
            Alert.alert('Alarm Disabled', 'Your alarm has been turned off.');
        }
    };

    const resetAlarmForTesting = async () => {
        await AlarmManager.resetTriggeredStatus();
        setLastTriggeredDate(null);
        Alert.alert('Reset Complete', 'Alarm can now trigger again today.');
    };

    const formatTime = (h: number, m: number): string => {
        const period = h >= 12 ? 'PM' : 'AM';
        const displayHour = h % 12 || 12;
        const displayMinute = m.toString().padStart(2, '0');
        return `${displayHour}:${displayMinute} ${period}`;
    };

    const adjustTime = (type: 'hour' | 'minute', delta: number) => {
        if (type === 'hour') {
            setHour((prev) => (prev + delta + 24) % 24);
        } else {
            setMinute((prev) => (prev + delta + 60) % 60);
        }
    };

    const toggleDay = (day: number) => {
        setSelectedDays((prev) =>
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
        );
    };

    const formatTimeUntil = () => {
        const { hours, minutes, seconds } = timeUntil;
        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>⏰ Walk-to-Wake Alarm</Text>
                <Text style={styles.subtitle}>
                    Set an alarm that requires walking to dismiss
                </Text>
            </View>

            {/* Time Picker */}
            <View style={styles.timePickerContainer}>
                <View style={styles.timeColumn}>
                    <TouchableOpacity
                        style={styles.timeButton}
                        onPress={() => adjustTime('hour', 1)}
                    >
                        <Text style={styles.timeButtonText}>▲</Text>
                    </TouchableOpacity>
                    <Text style={styles.timeValue}>
                        {(hour % 12 || 12).toString().padStart(2, '0')}
                    </Text>
                    <TouchableOpacity
                        style={styles.timeButton}
                        onPress={() => adjustTime('hour', -1)}
                    >
                        <Text style={styles.timeButtonText}>▼</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.timeSeparator}>:</Text>

                <View style={styles.timeColumn}>
                    <TouchableOpacity
                        style={styles.timeButton}
                        onPress={() => adjustTime('minute', 5)}
                    >
                        <Text style={styles.timeButtonText}>▲</Text>
                    </TouchableOpacity>
                    <Text style={styles.timeValue}>
                        {minute.toString().padStart(2, '0')}
                    </Text>
                    <TouchableOpacity
                        style={styles.timeButton}
                        onPress={() => adjustTime('minute', -5)}
                    >
                        <Text style={styles.timeButtonText}>▼</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.periodButton}
                    onPress={() => setHour((prev) => (prev + 12) % 24)}
                >
                    <Text style={styles.periodText}>{hour >= 12 ? 'PM' : 'AM'}</Text>
                </TouchableOpacity>
            </View>

            {/* Time Until Alarm */}
            {enabled && selectedDays.length > 0 && (
                <View style={styles.timeUntilContainer}>
                    <Text style={styles.timeUntilLabel}>⏱️ Alarm in</Text>
                    <Text style={styles.timeUntilValue}>{formatTimeUntil()}</Text>
                    {lastTriggeredDate === new Date().toDateString() && (
                        <Text style={styles.triggeredNote}>
                            ✅ Already triggered today
                        </Text>
                    )}
                </View>
            )}

            {/* Days Selector */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>📅 Repeat Days</Text>
                <View style={styles.daysContainer}>
                    {DAYS.map((day, index) => (
                        <TouchableOpacity
                            key={day}
                            style={[
                                styles.dayButton,
                                selectedDays.includes(index) && styles.dayButtonActive,
                            ]}
                            onPress={() => toggleDay(index)}
                        >
                            <Text
                                style={[
                                    styles.dayButtonText,
                                    selectedDays.includes(index) && styles.dayButtonTextActive,
                                ]}
                            >
                                {day}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                {selectedDays.length === 0 && (
                    <Text style={styles.warningNote}>⚠️ Select at least one day</Text>
                )}
            </View>

            {/* Steps Required */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>👟 Steps to Dismiss</Text>
                <Text style={styles.sectionSubtitle}>
                    More steps = you'll be more awake!
                </Text>
                <View style={styles.stepsContainer}>
                    {STEP_OPTIONS.map((steps) => (
                        <TouchableOpacity
                            key={steps}
                            style={[
                                styles.stepOption,
                                requiredSteps === steps && styles.stepOptionActive,
                            ]}
                            onPress={() => setRequiredSteps(steps)}
                        >
                            <Text
                                style={[
                                    styles.stepOptionText,
                                    requiredSteps === steps && styles.stepOptionTextActive,
                                ]}
                            >
                                {steps}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Enable Toggle */}
            <View style={styles.toggleContainer}>
                <View>
                    <Text style={styles.toggleLabel}>Enable Alarm</Text>
                    <Text style={styles.toggleSublabel}>
                        {enabled ? '🟢 Alarm is active' : '⚫ Alarm is off'}
                    </Text>
                </View>
                <Switch
                    value={enabled}
                    onValueChange={setEnabled}
                    trackColor={{ false: '#475569', true: '#22c55e' }}
                    thumbColor={enabled ? '#ffffff' : '#94a3b8'}
                />
            </View>

            {/* Save Button */}
            <TouchableOpacity
                style={[styles.saveButton, selectedDays.length === 0 && styles.buttonDisabled]}
                onPress={saveAlarm}
                disabled={selectedDays.length === 0}
            >
                <Text style={styles.saveButtonText}>
                    💾 Save Alarm
                </Text>
            </TouchableOpacity>

            {/* Test Button */}
            <TouchableOpacity style={styles.testButton} onPress={onTestAlarm}>
                <Text style={styles.testButtonText}>🧪 Test Alarm Now</Text>
            </TouchableOpacity>

            {/* Reset Button (for testing) */}
            <TouchableOpacity style={styles.resetButton} onPress={resetAlarmForTesting}>
                <Text style={styles.resetButtonText}>🔄 Reset for Testing</Text>
            </TouchableOpacity>

            {/* Info Box */}
            <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>💡 How it works:</Text>
                <Text style={styles.infoText}>
                    1. Set your wake-up time and days{'\n'}
                    2. When the alarm rings, you MUST walk to turn it off{'\n'}
                    3. Anti-cheat prevents phone shaking{'\n'}
                    4. Actually walking gets you fully awake!
                </Text>
            </View>

            {/* Keep App Open Warning */}
            <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>⚠️ Important for Alarm to Work:</Text>
                <Text style={styles.warningText}>
                    • Keep app open in background{'\n'}
                    • Don't force-close the app{'\n'}
                    • Alarm checks every 10 seconds{'\n'}
                    • For production: Use system alarm with this app for wake tasks
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
        marginBottom: 25,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#94a3b8',
        textAlign: 'center',
    },
    timePickerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
    },
    timeColumn: {
        alignItems: 'center',
    },
    timeButton: {
        padding: 10,
    },
    timeButtonText: {
        fontSize: 22,
        color: '#f97316',
    },
    timeValue: {
        fontSize: 56,
        fontWeight: 'bold',
        color: '#ffffff',
        width: 85,
        textAlign: 'center',
    },
    timeSeparator: {
        fontSize: 56,
        fontWeight: 'bold',
        color: '#ffffff',
        marginHorizontal: 5,
    },
    periodButton: {
        backgroundColor: '#f97316',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        marginLeft: 12,
    },
    periodText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    timeUntilContainer: {
        alignItems: 'center',
        marginBottom: 20,
        padding: 15,
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.3)',
    },
    timeUntilLabel: {
        color: '#94a3b8',
        fontSize: 14,
        marginBottom: 4,
    },
    timeUntilValue: {
        color: '#22c55e',
        fontSize: 32,
        fontWeight: 'bold',
    },
    triggeredNote: {
        color: '#22c55e',
        fontSize: 12,
        marginTop: 6,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 6,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: '#64748b',
        marginBottom: 10,
    },
    daysContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#1e293b',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayButtonActive: {
        backgroundColor: '#f97316',
    },
    dayButtonText: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '600',
    },
    dayButtonTextActive: {
        color: '#ffffff',
    },
    warningNote: {
        color: '#f59e0b',
        fontSize: 12,
        marginTop: 8,
    },
    stepsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    stepOption: {
        flex: 1,
        marginHorizontal: 3,
        paddingVertical: 14,
        backgroundColor: '#1e293b',
        borderRadius: 10,
        alignItems: 'center',
    },
    stepOptionActive: {
        backgroundColor: '#f97316',
    },
    stepOptionText: {
        color: '#64748b',
        fontSize: 16,
        fontWeight: 'bold',
    },
    stepOptionTextActive: {
        color: '#ffffff',
    },
    toggleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        borderRadius: 14,
        padding: 18,
        marginBottom: 20,
    },
    toggleLabel: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '600',
    },
    toggleSublabel: {
        color: '#64748b',
        fontSize: 13,
        marginTop: 3,
    },
    saveButton: {
        backgroundColor: '#22c55e',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginBottom: 10,
    },
    buttonDisabled: {
        backgroundColor: '#475569',
    },
    saveButtonText: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: 'bold',
    },
    testButton: {
        backgroundColor: '#6366f1',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginBottom: 10,
    },
    testButtonText: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: 'bold',
    },
    resetButton: {
        backgroundColor: '#475569',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        marginBottom: 20,
    },
    resetButtonText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '600',
    },
    infoBox: {
        backgroundColor: '#1e293b',
        borderRadius: 14,
        padding: 18,
        marginBottom: 12,
    },
    infoTitle: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    infoText: {
        color: '#94a3b8',
        fontSize: 13,
        lineHeight: 20,
    },
    warningBox: {
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(234, 179, 8, 0.3)',
        borderRadius: 14,
        padding: 18,
    },
    warningTitle: {
        color: '#eab308',
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    warningText: {
        color: '#fde047',
        fontSize: 13,
        lineHeight: 20,
    },
});

export default SetAlarmScreen;