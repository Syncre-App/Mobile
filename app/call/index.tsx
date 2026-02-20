import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { callService } from '../services/CallService';

export default function CallRedirectScreen() {
  const { chatId, callType } = useLocalSearchParams<{ chatId: string; callType: string }>();
  const router = useRouter();

  useEffect(() => {
    const initiateCall = async () => {
      if (!chatId) {
        router.back();
        return;
      }

      const success = await callService.initiateCall(chatId, callType === 'video' ? 'video' : 'audio');
      
      if (success) {
        router.replace('/call');
      } else {
        router.back();
      }
    };

    initiateCall();
  }, [chatId, callType]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1E84FF" />
      <Text style={styles.text}>Starting {callType === 'video' ? 'video' : 'voice'} call...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
});
