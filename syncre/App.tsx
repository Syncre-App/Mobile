import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen } from './screens/LoginScreen';
import { StorageService } from './services/StorageService';

const Stack = createStackNavigator();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuthToken();
  }, []);

  const checkAuthToken = async () => {
    try {
      const token = await StorageService.getAuthToken();
      setIsLoggedIn(!!token);
    } catch (error) {
      console.error('Error checking auth token:', error);
      setIsLoggedIn(false);
    }
  };

  if (isLoggedIn === null) {
    // Loading state - you can add a loading screen here
    return null;
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor="#03040A" />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: '#03040A' },
        }}
      >
        {!isLoggedIn ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          // Add your authenticated screens here
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
