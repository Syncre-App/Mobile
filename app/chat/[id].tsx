import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { ApiService } from '../../services/ApiService';
import { WebSocketService } from '../../services/WebSocketService';
import { UserCacheService } from '../../services/UserCacheService';

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
}

interface MessageBubbleProps {
  item: Message;
  isMyMessage: boolean;
  currentUserId: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ item, isMyMessage, currentUserId }) => {
  const [senderUsername, setSenderUsername] = useState<string>('Loading...');

  useEffect(() => {
    const fetchSenderUsername = async () => {
      if (isMyMessage) {
        setSenderUsername('You'); // Or current user's username
        return;
      }
      try {
        const sender = await UserCacheService.getUser(item.senderId);
        setSenderUsername(sender?.username || 'Unknown User');
      } catch (error) {
        console.error(`Error fetching sender username for ID: ${item.senderId}:`, error);
        setSenderUsername('Unknown User');
      }
    };
    fetchSenderUsername();
  }, [item.senderId, isMyMessage, currentUserId]);

  return (
    <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.theirMessage]}>
      {!isMyMessage && senderUsername !== 'Loading...' && senderUsername !== 'Unknown User' && (
        <Text style={styles.senderName}>{senderUsername}</Text>
      )}
      <Text style={styles.messageContent}>{item.content}</Text>
      <Text style={styles.messageTimestamp}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
    </View>
  );
};

const ChatScreen = () => {
  const { id } = useLocalSearchParams();
  const receiverId = Array.isArray(id) ? id[0] : id;
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [receiverUsername, setReceiverUsername] = useState<string>('Loading...');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!user || !receiverId) {
      console.warn('User or receiverId is missing.');
      return;
    }

    const fetchReceiverUsername = async () => {
      try {
        const receiver = await UserCacheService.getUser(receiverId);
        if (receiver) {
          setReceiverUsername(receiver.username);
        } else {
          setReceiverUsername('Unknown User');
        }
      } catch (error) {
        console.error(`Error fetching receiver username for ID: ${receiverId}:`, error);
        setReceiverUsername('Unknown User');
      }
    };

    fetchReceiverUsername();

    const fetchMessages = async () => {
      try {
        const fetchedMessages = await ApiService.get(`/chat/${receiverId}/messages`);
        setMessages(fetchedMessages);
      } catch (error) {
        console.error(`Error fetching messages for chat with ID: ${receiverId}:`, error);
      }
    };

    fetchMessages();

    WebSocketService.connect();
    WebSocketService.onMessage((message) => {
      // Assuming message format is { senderId, receiverId, content, timestamp }
      // Filter messages relevant to the current chat
      if ((message.senderId === user.id && message.receiverId === receiverId) ||
          (message.senderId === receiverId && message.receiverId === user.id)) {
        setMessages((prevMessages) => [...prevMessages, {
          id: message.id || Date.now().toString(), // Assign a temporary ID if not present
          senderId: message.senderId,
          receiverId: message.receiverId,
          content: message.content,
          timestamp: message.timestamp || new Date().toISOString(),
        }]);
      }
    });

    return () => {
      WebSocketService.disconnect();
    };
  }, [user, receiverId]);

  useEffect(() => {
    // Scroll to the bottom when messages update
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !receiverId) return;

    const messageToSend = {
      receiverId: receiverId as string,
      content: newMessage.trim(),
    };

    try {
      // Optimistically add message to UI
      const tempMessage: Message = {
        id: Date.now().toString(), // Temporary ID
        senderId: user.id,
        receiverId: receiverId as string,
        content: newMessage.trim(),
        timestamp: new Date().toISOString(),
      };
      setMessages((prevMessages) => [...prevMessages, tempMessage]);
      setNewMessage('');

      await ApiService.post('/chat/send', messageToSend);
      // No need to update messages again if WebSocket handles it
    } catch (error) {
      console.error(`Error sending message to receiver ID: ${receiverId}, content: ${messageToSend.content}:`, error);
      // Revert optimistic update or show error
      setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== tempMessage.id));
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderId === user?.id;
    return <MessageBubble item={item} isMyMessage={isMyMessage} currentUserId={user.id} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Stack.Screen options={{ title: `Chat with ${receiverUsername}` }} />

      <LinearGradient
        colors={['#03040A', '#071026']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{`Chat with ${receiverUsername}`}</Text>
        <View style={styles.headerButton} /> {/* Placeholder for right button */}
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            multiline
          />
          <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
            <Ionicons name="send" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent', // Ensure header background is transparent to show gradient
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007bff', // Changed to a more vibrant blue
    borderBottomRightRadius: 2,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0e0e0',
    borderBottomLeftRadius: 2,
  },
  senderName: {
    fontWeight: 'bold',
    marginBottom: 2,
    color: '#333',
  },
  messageContent: {
    fontSize: 16,
    color: '#333',
  },
  messageTimestamp: {
    fontSize: 10,
    color: '#666',
    alignSelf: 'flex-end',
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'transparent', // Ensure input background is transparent
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    fontSize: 16,
    color: 'white',
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#0EA5FF',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatScreen;