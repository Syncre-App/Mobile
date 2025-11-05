import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#03040A' }}>
      <StatusBar style="light" backgroundColor="#03040A" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#03040A' },
        }}
      />
    </GestureHandlerRootView>
  );
}
