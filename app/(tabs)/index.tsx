// app/(tabs)/index.tsx
import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import PedometerTest from '../../components/PedometerTest';

export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <PedometerTest />
    </SafeAreaView>
  );
}