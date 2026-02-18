# Syncre Mobile API Integration Guide

This document provides detailed guidance on integrating the Syncre mobile application with the backend API. For the complete API reference, see the [Backend API Documentation](../Backend/API.md).

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication Flow](#authentication-flow)
3. [API Service Usage](#api-service-usage)
4. [WebSocket Communication](#websocket-communication)
5. [End-to-End Encryption](#end-to-end-encryption)
6. [Common Patterns](#common-patterns)
7. [Error Handling](#error-handling)

---

## Getting Started

### Configuration

The API service automatically resolves the base URL:

```typescript
// Environment variable (optional)
EXPO_PUBLIC_API_URL=https://api.syncre.xyz/v1

// Fallback to production
const BASE_URL = 'https://api.syncre.xyz/v1';
```

### Authentication State

Authentication tokens are managed through the `StorageService` using Expo Secure Store:

```typescript
import { StorageService } from '../services/StorageService';

// Save token
await StorageService.setToken(jwtToken);

// Get token
const token = await StorageService.getToken();

// Remove token
await StorageService.removeToken();
```

---

## Authentication Flow

### Registration

```typescript
import { ApiService } from '../services/ApiService';

async function registerUser(email: string, password: string, username: string) {
  const response = await ApiService.post('/auth/register', {
    email,
    password,
    username,
    acceptedTerms: true
  });
  
  if (response.success) {
    // Registration successful - user needs to verify email
    return response.data;
  } else {
    throw new Error(response.error);
  }
}
```

### Email Verification

```typescript
async function verifyEmail(email: string, code: string) {
  const response = await ApiService.post('/auth/verify', {
    email,
    code
  });
  
  if (response.success) {
    return response.data;
  }
  throw new Error(response.error);
}
```

### Login

```typescript
import { StorageService } from '../services/StorageService';
import { IdentityService } from '../services/IdentityService';

async function loginUser(email: string, password: string) {
  const response = await ApiService.post('/auth/login', {
    email,
    password
  });
  
  if (response.success) {
    const { token, user, identityKey } = response.data;
    
    // Save authentication data
    await StorageService.setToken(token);
    await StorageService.setUserId(user.id);
    
    // Handle identity key
    if (identityKey) {
      // Decrypt and restore identity key
      await IdentityService.restoreIdentityKey(identityKey, password);
    } else {
      // Generate new identity key for new user
      await IdentityService.generateIdentityKey(password);
    }
    
    return { token, user };
  }
  
  throw new Error(response.error);
}
```

### Logout

```typescript
async function logout() {
  // Disconnect WebSocket
  WebSocketService.disconnect();
  
  // Clear stored data
  await StorageService.removeToken();
  await StorageService.removeUserId();
  
  // Navigate to login screen
  router.replace('/login');
}
```

---

## API Service Usage

### Basic Request Patterns

All API methods follow a consistent pattern:

```typescript
// GET request
const response = await ApiService.get('/user/me', token);

// POST request
const response = await ApiService.post('/chat/group', {
  members: [userId1, userId2],
  name: 'My Group'
}, token);

// PUT request
const response = await ApiService.put('/chat/123', {
  name: 'Updated Name'
}, token);

// DELETE request
const response = await ApiService.delete('/chat/123', token);
```

### Response Format

All API methods return a standardized response:

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}
```

### File Uploads

#### Direct Upload (files < 95MB)

```typescript
async function uploadAttachment(chatId: string, file: any) {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    type: file.mimeType,
    name: file.name
  } as any);
  
  const token = await StorageService.getToken();
  const response = await ApiService.upload(
    `/chat/${chatId}/attachments`,
    formData,
    token
  );
  
  return response;
}
```

#### Chunked Upload (files > 95MB)

```typescript
import * as FileSystem from 'expo-file-system';

const CHUNK_SIZE = 80 * 1024 * 1024; // 80MB

async function uploadLargeFile(chatId: string, fileUri: string) {
  const token = await StorageService.getToken();
  
  // Get file info
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  const fileSize = fileInfo.size;
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
  
  // Start upload session
  const startResponse = await ApiService.post(
    `/chat/${chatId}/attachments/chunk/start`,
    {
      filename: 'largefile.zip',
      totalSize: fileSize,
      mimeType: 'application/zip'
    },
    token
  );
  
  if (!startResponse.success) {
    throw new Error(startResponse.error);
  }
  
  const { uploadId } = startResponse.data;
  
  // Upload chunks
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    
    // Read chunk
    const chunk = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: start,
      length: end - start
    });
    
    // Upload chunk
    const formData = new FormData();
    formData.append('chunk', {
      uri: `data:application/octet-stream;base64,${chunk}`,
      type: 'application/octet-stream',
      name: `chunk-${i}.part`
    } as any);
    formData.append('chunkIndex', i.toString());
    
    await ApiService.upload(
      `/chat/${chatId}/attachments/chunk/${uploadId}`,
      formData,
      token
    );
  }
  
  // Complete upload
  const completeResponse = await ApiService.post(
    `/chat/${chatId}/attachments/chunk/${uploadId}/complete`,
    {
      filename: 'largefile.zip',
      totalChunks
    },
    token
  );
  
  return completeResponse;
}
```

### User Operations

#### Get Current User

```typescript
async function getCurrentUser() {
  const token = await StorageService.getToken();
  const response = await ApiService.get('/user/me', token);
  
  if (response.success) {
    return response.data;
  }
  throw new Error(response.error);
}
```

#### Search Users

```typescript
async function searchUsers(query: string) {
  const token = await StorageService.getToken();
  const response = await ApiService.get(
    `/user/search?q=${encodeURIComponent(query)}`,
    token
  );
  
  if (response.success) {
    return response.data;
  }
  return [];
}
```

#### Friend Management

```typescript
// Send friend request
async function sendFriendRequest(userId: string) {
  const token = await StorageService.getToken();
  return ApiService.post('/user/add', { userId }, token);
}

// Accept friend request
async function acceptFriendRequest(userId: string) {
  const token = await StorageService.getToken();
  return ApiService.post('/user/respond', { userId, accept: true }, token);
}

// Remove friend
async function removeFriend(userId: string) {
  const token = await StorageService.getToken();
  return ApiService.post('/user/remove', { userId }, token);
}

// Get friends list
async function getFriends() {
  const token = await StorageService.getToken();
  const response = await ApiService.get('/user/friends', token);
  
  if (response.success) {
    return {
      friends: response.data.friends || [],
      pending: response.data.pending || { incoming: [], outgoing: [] }
    };
  }
  return { friends: [], pending: { incoming: [], outgoing: [] } };
}
```

### Chat Operations

#### Get Chats

```typescript
async function getChats() {
  const token = await StorageService.getToken();
  const response = await ApiService.get('/chat', token);
  
  if (response.success) {
    return response.data.chats || [];
  }
  return [];
}
```

#### Get Messages

```typescript
async function getMessages(chatId: string, before?: number, limit = 50) {
  const token = await StorageService.getToken();
  let url = `/chat/${chatId}/messages?limit=${limit}`;
  
  if (before) {
    url += `&before=${before}`;
  }
  
  const response = await ApiService.get(url, token);
  
  if (response.success) {
    return response.data.messages || [];
  }
  return [];
}
```

#### Create Group Chat

```typescript
async function createGroupChat(members: string[], name: string, avatar?: any) {
  const token = await StorageService.getToken();
  
  const formData = new FormData();
  formData.append('members', JSON.stringify(members));
  formData.append('name', name);
  
  if (avatar) {
    formData.append('avatar', {
      uri: avatar.uri,
      type: avatar.mimeType,
      name: avatar.name
    } as any);
  }
  
  return ApiService.upload('/chat/group', formData, token);
}
```

---

## WebSocket Communication

### Connecting

```typescript
import { WebSocketService } from '../services/WebSocketService';
import { StorageService } from '../services/StorageService';

async function connectToRealtime() {
  const token = await StorageService.getToken();
  
  await WebSocketService.connect(token);
  
  // Add message listener
  WebSocketService.addMessageListener(handleMessage);
  
  // Handle connection state
  WebSocketService.onStateChange((state) => {
    console.log('WebSocket state:', state);
  });
}

function handleMessage(message: any) {
  switch (message.type) {
    case 'message_envelope':
      // Handle incoming encrypted message
      handleEncryptedMessage(message);
      break;
    case 'new_message':
      // Handle plain message
      handlePlainMessage(message);
      break;
    case 'message_status':
      // Handle delivery/read receipts
      updateMessageStatus(message.messageId, message.status);
      break;
    case 'friend_status_change':
      // Handle friend online/offline
      updateFriendStatus(message.userId, message.status);
      break;
  }
}
```

### Joining Chats

```typescript
import { StorageService } from '../services/StorageService';

async function joinChatRoom(chatId: string) {
  const deviceId = await StorageService.getDeviceId();
  
  WebSocketService.joinChat(chatId, deviceId);
}

function leaveChatRoom(chatId: string) {
  WebSocketService.send({
    type: 'chat_leave',
    chatId
  });
}
```

### Sending Messages

#### Encrypted Message

```typescript
import { CryptoService } from '../services/CryptoService';
import { KeyService } from '../services/KeyService';

async function sendEncryptedMessage(
  chatId: string,
  content: string,
  recipientIds: string[]
) {
  // Get recipient device keys
  const deviceKeys = await KeyService.getDeviceKeysForUsers(recipientIds);
  
  // Generate ephemeral key pair
  const ephemeralKeyPair = await CryptoService.generateKeyPair();
  
  // Encrypt message for each device
  const envelopes = [];
  for (const device of deviceKeys) {
    const encrypted = await CryptoService.encryptMessage(
      content,
      device.publicKey,
      ephemeralKeyPair.secretKey
    );
    
    envelopes.push({
      recipientId: device.userId,
      recipientDevice: device.deviceId,
      payload: encrypted.payload,
      nonce: encrypted.nonce,
      keyVersion: device.keyVersion,
      alg: 'x25519-xsalsa20-poly1305',
      senderIdentityKey: await IdentityService.getPublicKey(),
      version: 1
    });
  }
  
  // Get own device ID
  const deviceId = await StorageService.getDeviceId();
  
  // Send via WebSocket
  WebSocketService.send({
    type: 'chat_message',
    chatId,
    content: '', // Empty for encrypted messages
    deviceId,
    envelopes,
    backupEnvelopes: [] // Optional
  });
}
```

#### Typing Indicator

```typescript
function sendTypingIndicator(chatId: string) {
  WebSocketService.sendTyping(chatId);
}

function stopTypingIndicator(chatId: string) {
  WebSocketService.send({
    type: 'stop-typing',
    chatId
  });
}
```

### Receiving Messages

```typescript
import { CryptoService } from '../services/CryptoService';
import { IdentityService } from '../services/IdentityService';

async function handleEncryptedMessage(message: any) {
  try {
    // Get private key
    const privateKey = await IdentityService.getPrivateKey();
    
    // Decrypt message
    const decrypted = await CryptoService.decryptMessage(
      message.content,
      message.nonce,
      privateKey,
      message.senderIdentityKey
    );
    
    // Process decrypted message
    console.log('Decrypted:', decrypted);
    
    // Send read receipt
    WebSocketService.send({
      type: 'message_status',
      messageId: message.messageId,
      chatId: message.chatId,
      status: 'read'
    });
  } catch (error) {
    console.error('Failed to decrypt message:', error);
  }
}
```

---

## End-to-End Encryption

### Key Generation

```typescript
import { CryptoService } from '../services/CryptoService';
import { IdentityService } from '../services/IdentityService';

// Generate identity key (done once during registration)
async function setupEncryption(password: string) {
  // Generate identity key pair
  const identityKey = await CryptoService.generateIdentityKey();
  
  // Encrypt private key with password
  const encryptedPrivateKey = await CryptoService.encryptPrivateKey(
    identityKey.secretKey,
    password
  );
  
  // Save to server
  await IdentityService.saveIdentityKey({
    publicKey: identityKey.publicKey,
    encryptedPrivateKey: encryptedPrivateKey.payload,
    nonce: encryptedPrivateKey.nonce,
    salt: encryptedPrivateKey.salt,
    iterations: encryptedPrivateKey.iterations,
    version: 1
  });
  
  // Generate device key
  const deviceKey = await CryptoService.generateKeyPair();
  const deviceId = await StorageService.getDeviceId();
  
  // Register device key
  await KeyService.registerDevice(deviceId, deviceKey.publicKey);
  
  // Store device key securely
  await StorageService.setDeviceKey(deviceKey);
}
```

### Device Key Registration

```typescript
import { KeyService } from '../services/KeyService';

async function registerDevice() {
  const deviceId = await StorageService.getDeviceId();
  const deviceKey = await StorageService.getDeviceKey();
  
  const token = await StorageService.getToken();
  
  await ApiService.post('/keys/register', {
    deviceId,
    publicKey: deviceKey.publicKey,
    keyVersion: 1
  }, token);
}
```

### Encrypting for Multiple Devices

```typescript
async function encryptForAllDevices(
  plaintext: string,
  recipientUserIds: string[]
) {
  const ephemeralKeyPair = await CryptoService.generateKeyPair();
  const envelopes = [];
  
  // Get all device keys for recipients
  for (const userId of recipientUserIds) {
    const devices = await KeyService.getDeviceKeys(userId);
    
    for (const device of devices) {
      const encrypted = await CryptoService.boxEncrypt(
        plaintext,
        device.publicKey,
        ephemeralKeyPair.secretKey
      );
      
      envelopes.push({
        recipientId: userId,
        recipientDevice: device.deviceId,
        payload: encrypted.box,
        nonce: encrypted.nonce,
        keyVersion: device.keyVersion,
        alg: 'x25519-xsalsa20-poly1305',
        senderIdentityKey: await IdentityService.getPublicKey(),
        version: 1
      });
    }
  }
  
  return { ephemeralPublicKey: ephemeralKeyPair.publicKey, envelopes };
}
```

---

## Common Patterns

### Pagination

```typescript
async function loadMessages(chatId: string) {
  const messages = [];
  let hasMore = true;
  let before: number | undefined;
  
  while (hasMore) {
    const response = await ApiService.get(
      `/chat/${chatId}/messages?limit=50${before ? `&before=${before}` : ''}`,
      token
    );
    
    if (response.success && response.data.messages.length > 0) {
      messages.push(...response.data.messages);
      before = response.data.messages[response.data.messages.length - 1].id;
    } else {
      hasMore = false;
    }
  }
  
  return messages;
}
```

### Optimistic Updates

```typescript
function sendMessageOptimistically(chatId: string, content: string) {
  // Generate temporary ID
  const tempId = `temp-${Date.now()}`;
  
  // Add to local state immediately
  addMessage({
    id: tempId,
    content,
    status: 'sending',
    created_at: new Date().toISOString()
  });
  
  // Send actual message
  WebSocketService.send({
    type: 'chat_message',
    chatId,
    content,
    tempId
  });
  
  // Update on confirmation
  WebSocketService.addMessageListener((msg) => {
    if (msg.type === 'message_envelope_sent' && msg.tempId === tempId) {
      updateMessage(tempId, { id: msg.messageId, status: 'sent' });
    }
  });
}
```

### Caching Users

The `ApiService` automatically caches user data:

```typescript
// User data is cached automatically when fetching
const response = await ApiService.get('/user/search?q=john', token);

// Later, get cached user without API call
const cachedUser = UserCacheService.getUser(userId);
```

### Handling Network Errors

```typescript
async function safeApiCall<T>(
  apiCall: () => Promise<ApiResponse<T>>
): Promise<T | null> {
  try {
    const response = await apiCall();
    
    if (response.success) {
      return response.data;
    }
    
    // Handle specific errors
    if (response.statusCode === 401) {
      // Token expired - redirect to login
      await logout();
      return null;
    }
    
    if (response.statusCode === 429) {
      // Rate limited - show message
      showToast('Too many requests. Please try again later.');
      return null;
    }
    
    showToast(response.error || 'An error occurred');
    return null;
  } catch (error) {
    console.error('API Error:', error);
    showToast('Network error. Please check your connection.');
    return null;
  }
}
```

---

## Error Handling

### HTTP Status Codes

Common status codes and their meanings:

- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (token expired or invalid)
- `403` - Forbidden (banned, unverified, or insufficient permissions)
- `404` - Not Found
- `409` - Conflict (e.g., duplicate resource)
- `422` - Validation Error
- `429` - Rate Limited
- `500` - Server Error

### Handling Authentication Errors

```typescript
ApiService.get('/user/me', token).then(response => {
  if (!response.success && response.statusCode === 401) {
    // Token expired - try refresh or logout
    handleTokenExpiration();
  }
});

async function handleTokenExpiration() {
  // Clear stored token
  await StorageService.removeToken();
  
  // Navigate to login
  router.replace('/login');
}
```

### Retry Logic

```typescript
async function retryApiCall<T>(
  apiCall: () => Promise<ApiResponse<T>>,
  maxRetries = 3
): Promise<ApiResponse<T>> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    const response = await apiCall();
    
    if (response.success) {
      return response;
    }
    
    // Don't retry on client errors
    if (response.statusCode >= 400 && response.statusCode < 500) {
      return response;
    }
    
    lastError = response.error;
    
    // Wait before retry (exponential backoff)
    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
  }
  
  return {
    success: false,
    error: lastError || 'Max retries exceeded',
    statusCode: 0
  };
}
```

---

## Advanced Topics

### Scheduled Messages

```typescript
async function scheduleMessage(
  chatId: string,
  content: string,
  scheduledFor: Date
) {
  const token = await StorageService.getToken();
  
  const response = await ApiService.scheduleMessage(
    chatId,
    {
      content,
      scheduledFor: scheduledFor.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isEncrypted: false // or true with envelopes
    },
    token
  );
  
  return response;
}
```

### Polls

```typescript
async function createPoll(
  chatId: string,
  question: string,
  options: string[]
) {
  const token = await StorageService.getToken();
  const deviceId = await StorageService.getDeviceId();
  
  return ApiService.createPoll(
    chatId,
    {
      question,
      options,
      multiSelect: false,
      senderDeviceId: deviceId
    },
    token
  );
}

async function votePoll(chatId: string, pollId: string, optionIds: number[]) {
  const token = await StorageService.getToken();
  
  return ApiService.votePoll(chatId, pollId, optionIds, token);
}
```

### Spotify Integration

```typescript
// Get auth URL
async function connectSpotify() {
  const token = await StorageService.getToken();
  const response = await ApiService.getSpotifyAuthUrl(token);
  
  if (response.success) {
    // Open auth URL in browser
    await Linking.openURL(response.data.authUrl);
  }
}

// Check current track
async function getNowPlaying() {
  const token = await StorageService.getToken();
  const response = await ApiService.getSpotifyNowPlaying(token);
  
  if (response.success && response.data.isPlaying) {
    return response.data.track;
  }
  return null;
}
```

---

## Best Practices

1. **Always check response.success** before accessing response.data
2. **Handle 401 errors** by redirecting to login
3. **Use WebSocket for real-time** features instead of polling
4. **Cache user data** to reduce API calls
5. **Encrypt sensitive data** before sending to server
6. **Use chunked upload** for files larger than 95MB
7. **Implement retry logic** for network failures
8. **Show loading states** during API calls
9. **Handle offline scenarios** gracefully
10. **Clean up WebSocket listeners** when components unmount

---

## Related Documentation

- [Backend API Documentation](../Backend/API.md) - Complete API reference
- [Mobile README](./README.md) - Project overview and setup
