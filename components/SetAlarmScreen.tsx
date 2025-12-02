// components/SetAlarmScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Alarm {
    id: string;
    hour: number;
    minute: number;
    enabled: boolean;
    requiredSteps: number;
    label: string;
    days: number[]; // 0-6 for Sun-Sat
}

interface SetAlarmScreenProps {
    onTestAlarm: () => void;
    activeAlarm: Alarm | null;
    setActiveAlarm: (alarm: Alarm | null) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STEP_OPTIONS = [10, 15, 20, 30, 50];

const SetAlarmScreen: React.FC<SetAlarmScreenProps> = ({
    onTestAlarm,
    activeAlarm,
    setActiveAlarm,
}) => {
    const [hour, setHour] = useState<number>(6);
    const [minute, setMinute] = useState<number>(0);
    const [enabled, setEnabled] = useState<boolean>(false);
    const [requiredSteps, setRequiredSteps] = useState<number>(10);
    const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
    const [timeUntilAlarm, setTimeUntilAlarm] = useState<string>('');

    useEffect(() => {
        loadAlarm();
    }, []);

    useEffect(() => {
        if (enabled) {
            updateTimeUntilAlarm();
            const interval = setInterval(updateTimeUntilAlarm, 60000);
            return () => clearInterval(interval);
        }
    }, [enabled, hour, minute]);

    const loadAlarm = async () => {
        try {
            const saved = await AsyncStorage.getItem('walkAlarm');
            if (saved) {
                const alarm: Alarm = JSON.parse(saved);
                setHour(alarm.hour);
                setMinute(alarm.minute);
                setEnabled(alarm.enabled);
                setRequiredSteps(alarm.requiredSteps);
                setSelectedDays(alarm.days);

                if (alarm.enabled) {
                    setActiveAlarm(alarm);
                }
            }
        } catch (error) {
            console.error('Error loading alarm:', error);
        }
    };

    const saveAlarm = async () => {
        const alarm: Alarm = {
            id: 'main',
            hour,
            minute,
            enabled,
            requiredSteps,
            label: 'Wake Up',
            days: selectedDays,
        };

        try {
            await AsyncStorage.setItem('walkAlarm', JSON.stringify(alarm));
            setActiveAlarm(enabled ? alarm : null);

            if (enabled) {
                Alert.alert(
                    '⏰ Alarm Set!',
                    `Alarm set for ${formatTime(hour, minute)}\nYou'll need to walk ${requiredSteps} steps to dismiss it.`,
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Error saving alarm:', error);
        }
    };

    const updateTimeUntilAlarm = () => {
        const now = new Date();
        const alarmTime = new Date();
        alarmTime.setHours(hour, minute, 0, 0);

        if (alarmTime <= now) {
            alarmTime.setDate(alarmTime.getDate() + 1);
        }

        const diff = alarmTime.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        setTimeUntilAlarm(`${hours}h ${minutes}m`);
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
            prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
        );
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
            {enabled && (
                <View style={styles.timeUntilContainer}>
                    <Text style={styles.timeUntilLabel}>Alarm in</Text>
                    <Text style={styles.timeUntilValue}>{timeUntilAlarm}</Text>
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
            </View>

            {/* Steps Required */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>👟 Steps to Dismiss</Text>
                <Text style={styles.sectionSubtitle}>
                    More steps = harder to cheat!
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
                    onValueChange={(value) => {
                        setEnabled(value);
                        if (!value) {
                            setActiveAlarm(null);
                        }
                    }}
                    trackColor={{ false: '#475569', true: '#22c55e' }}
                    thumbColor={enabled ? '#ffffff' : '#94a3b8'}
                />
            </View>

            {/* Save Button */}
            <TouchableOpacity style={styles.saveButton} onPress={saveAlarm}>
                <Text style={styles.saveButtonText}>
                    {enabled ? '💾 Save Alarm' : '💾 Save Settings'}
                </Text>
            </TouchableOpacity>

            {/* Test Button */}
            <TouchableOpacity
                style={styles.testButton}
                onPress={onTestAlarm}
            >
                <Text style={styles.testButtonText}>🧪 Test Alarm Now</Text>
            </TouchableOpacity>

            {/* Info Box */}
            <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>💡 How it works:</Text>
                <Text style={styles.infoText}>
                    1. Set your wake-up time{'\n'}
                    2. When the alarm rings, you MUST walk to turn it off{'\n'}
                    3. The alarm cannot be dismissed any other way{'\n'}
                    4. Anti-cheat detects real walking vs shaking
                </Text>
            </View>

            {/* Warning */}
            <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>⚠️ Important:</Text>
                <Text style={styles.warningText}>
                    Keep the app open or in background for the alarm to work.
                    For best results, don't force-close the app before sleeping.
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
        marginBottom: 30,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#94a3b8',
        textAlign: 'center',
    },
    timePickerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1e293b',
        borderRadius: 24,
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
        fontSize: 24,
        color: '#f97316',
    },
    timeValue: {
        fontSize: 64,
        fontWeight: 'bold',
        color: '#ffffff',
        width: 90,
        textAlign: 'center',
    },
    timeSeparator: {
        fontSize: 64,
        fontWeight: 'bold',
        color: '#ffffff',
        marginHorizontal: 5,
    },
    periodButton: {
        backgroundColor: '#f97316',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginLeft: 15,
    },
    periodText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    timeUntilContainer: {
        alignItems: 'center',
        marginBottom: 25,
        padding: 15,
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.3)',
    },
    timeUntilLabel: {
        color: '#94a3b8',
        fontSize: 14,
    },
    timeUntilValue: {
        color: '#22c55e',
        fontSize: 24,
        fontWeight: 'bold',
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#ffffff',
        marginBottom: 8,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 12,
    },
    daysContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#1e293b',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayButtonActive: {
        backgroundColor: '#f97316',
    },
    dayButtonText: {
        color: '#64748b',
        fontSize: 13,
        fontWeight: '600',
    },
    dayButtonTextActive: {
        color: '#ffffff',
    },
    stepsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    stepOption: {
        flex: 1,
        marginHorizontal: 4,
        paddingVertical: 15,
        backgroundColor: '#1e293b',
        borderRadius: 12,
        alignItems: 'center',
    },
    stepOptionActive: {
        backgroundColor: '#f97316',
    },
    stepOptionText: {
        color: '#64748b',
        fontSize: 18,
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
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    toggleLabel: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
    },
    toggleSublabel: {
        color: '#64748b',
        fontSize: 14,
        marginTop: 4,
    },
    saveButton: {
        backgroundColor: '#22c55e',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 12,
    },
    saveButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    testButton: {
        backgroundColor: '#6366f1',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 25,
    },
    testButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    infoBox: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 20,
        marginBottom: 15,
    },
    infoTitle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    infoText: {
        color: '#94a3b8',
        fontSize: 14,
        lineHeight: 22,
    },
    warningBox: {
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(234, 179, 8, 0.3)',
        borderRadius: 16,
        padding: 20,
    },
    warningTitle: {
        color: '#eab308',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    warningText: {
        color: '#fde047',
        fontSize: 14,
        lineHeight: 20,
    },
});

export default SetAlarmScreen;