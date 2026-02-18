# Syncre Mobile

Syncre is a secure, cross-platform mobile communication application built with React Native and Expo. It focuses on privacy and security through end-to-end encryption for all communications.

## ✨ Features

- **Secure Messaging:** End-to-end encrypted one-on-one and group conversations
- **User Authentication:** Secure user registration, login, and profile management
- **Friend System:** Search for users, send friend requests, and manage friend lists
- **Real-time Communication:** WebSocket-based instant message delivery
- **Group Chats:** Create groups with up to 10 members, with customizable names and avatars
- **File Sharing:** Send images, videos, documents with chunked upload support for large files
- **Scheduled Messages:** Schedule messages to be sent at specific times
- **Polls:** Create and participate in polls within chats
- **Push Notifications:** Stay updated with new messages and friend requests
- **Cross-Platform:** Runs on iOS, Android, and Web from a single codebase
- **Spotify Integration:** Share what you're listening to with friends
- **Streaks:** Track consecutive days of messaging with friends

## 🚀 Technologies Used

- **Framework:** [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/)
- **Language:** TypeScript
- **Routing:** [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation
- **State Management:** React Context and custom hooks
- **Encryption:**
  - `tweetnacl` - NaCl cryptography library
  - `@stablelib/hkdf` - HKDF key derivation
  - `@stablelib/sha256` - SHA-256 hashing
  - `@stablelib/xchacha20poly1305` - XChaCha20-Poly1305 encryption
  - `expo-crypto` - Expo cryptography utilities
- **Storage:** 
  - `expo-secure-store` - Secure storage for sensitive data
  - `@react-native-async-storage/async-storage` - General persistent storage
- **Real-time:** WebSockets with custom `WebSocketService`
- **Push Notifications:** Expo Notifications
- **Media:** 
  - `expo-image` - Image handling
  - `expo-video` - Video playback
  - `expo-document-picker` - File selection
  - `expo-image-picker` - Camera and gallery access
- **Linting:** ESLint with TypeScript support

## 📱 API Integration

This mobile app communicates with the Syncre backend API. For detailed API documentation, see:

- **[Backend API Documentation](../Backend/API.md)** - Complete REST API and WebSocket protocol reference
- **[Mobile API Guide](./API.md)** - Mobile-specific API integration guide

### Quick API Overview

**Base URL:** `https://api.syncre.xyz/v1`

**WebSocket URL:** `wss://api.syncre.xyz/ws`

The app uses two main services for communication:

1. **ApiService** (`services/ApiService.ts`) - REST API client
2. **WebSocketService** (`services/WebSocketService.ts`) - Real-time communication

## 🏁 Getting Started

### Prerequisites

- Node.js (LTS version recommended, v18+)
- npm or pnpm
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your mobile device (iOS/Android) or Android Studio/Xcode for emulators

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Mobile
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Environment Setup:**
   Create a `.env` file in the Mobile directory:
   ```env
   EXPO_PUBLIC_API_URL=https://api.syncre.xyz/v1
   ```

## 📜 Available Scripts

- **`npm start`** - Start the development server with Expo
- **`npm run android`** - Run on Android device/emulator
- **`npm run ios`** - Run on iOS simulator/device
- **`npm run web`** - Run in web browser
- **`npm run lint`** - Lint the codebase using ESLint
- **`npm run build`** - Create production build for iOS via EAS Build
- **`npm run real-build`** - Create release builds for iOS and Android

## 📁 Project Structure

```
Mobile/
├── app/                      # Expo Router routes (screens)
│   ├── (tabs)/              # Tab-based navigation screens
│   │   ├── home.tsx         # Home/chat list screen
│   │   ├── friends.tsx      # Friends management screen
│   │   ├── profile.tsx      # User profile screen
│   │   └── _layout.tsx      # Tab navigation layout
│   ├── chat/                # Chat screens
│   │   └── [id].tsx         # Individual chat screen (dynamic route)
│   ├── login.tsx            # Login screen
│   ├── register.tsx         # Registration screen
│   ├── verify.tsx           # Email verification screen
│   └── _layout.tsx          # Root layout with providers
├── components/              # Reusable UI components
│   ├── MessageBubble.tsx    # Message display component
│   ├── ChatList.tsx         # Chat list component
│   └── ...
├── context/                 # React context providers
│   ├── AuthContext.tsx      # Authentication state
│   ├── ChatContext.tsx      # Chat/messaging state
│   └── ...
├── hooks/                   # Custom React hooks
│   ├── useAuth.ts           # Authentication hook
│   ├── useChat.ts           # Chat management hook
│   └── ...
├── services/                # Core services
│   ├── ApiService.ts        # REST API client
│   ├── WebSocketService.ts  # WebSocket communication
│   ├── CryptoService.ts     # Encryption/decryption
│   ├── IdentityService.ts   # Identity key management
│   ├── ReencryptionService.ts # Message re-encryption
│   ├── StorageService.ts    # Secure storage wrapper
│   └── ...
├── types/                   # TypeScript type definitions
├── constants/               # App constants
└── assets/                  # Static assets (images, fonts)
```

## 🔐 Security Architecture

### End-to-End Encryption (E2EE)

All messages are encrypted end-to-end using the following flow:

1. **Key Generation:** Each device generates an X25519 key pair
2. **Identity Keys:** Users have identity keys encrypted with their password
3. **Message Encryption:** Each message uses a unique ephemeral key
4. **Envelopes:** Encrypted messages are wrapped in "envelopes" for each recipient device
5. **Backup Envelopes:** Additional envelopes encrypted for backup/recovery

### Key Services

- **CryptoService** - Handles encryption/decryption operations
- **IdentityService** - Manages identity key pairs
- **ReencryptionService** - Re-encrypts messages for new devices

## 🌐 API Communication

### REST API (ApiService)

The `ApiService` class provides methods for all API interactions:

```typescript
// Authentication
const response = await ApiService.post('/auth/login', { email, password });

// Get chats
const chats = await ApiService.get('/chat', token);

// Send message (REST fallback)
await ApiService.post(`/chat/${chatId}/messages`, { content }, token);

// Upload file
const formData = new FormData();
formData.append('file', file);
await ApiService.upload(`/chat/${chatId}/attachments`, formData, token);
```

### WebSocket (WebSocketService)

Real-time messaging via WebSocket:

```typescript
// Connect and authenticate
await WebSocketService.connect(token);

// Join chat room
WebSocketService.joinChat(chatId, deviceId);

// Send encrypted message
WebSocketService.send({
  type: 'chat_message',
  chatId,
  content: encryptedContent,
  envelopes: [...],
  backupEnvelopes: [...]
});

// Listen for messages
WebSocketService.addMessageListener((message) => {
  console.log('Received:', message);
});
```

## 📝 Development Guide

### Adding a New Screen

1. Create a new file in `app/` directory (e.g., `app/settings.tsx`)
2. Use Expo Router's file-based routing automatically
3. Export a default React component:

```typescript
// app/settings.tsx
import { View, Text } from 'react-native';

export default function SettingsScreen() {
  return (
    <View>
      <Text>Settings</Text>
    </View>
  );
}
```

### Adding API Calls

Use the `ApiService` for REST API calls:

```typescript
import { ApiService } from '../services/ApiService';

async function fetchData() {
  const response = await ApiService.get('/endpoint', token);
  if (response.success) {
    return response.data;
  }
  throw new Error(response.error);
}
```

### Working with Encryption

```typescript
import { CryptoService } from '../services/CryptoService';

// Generate keys
const keyPair = await CryptoService.generateKeyPair();

// Encrypt message
const encrypted = await CryptoService.encryptMessage(plaintext, recipientPublicKey);

// Decrypt message
const decrypted = await CryptoService.decryptMessage(encrypted, privateKey);
```

## 🧪 Testing

Run linting to check code quality:

```bash
npm run lint
```

## 📦 Building for Production

### Using EAS Build

```bash
# iOS build
npm run build

# iOS and Android builds
npm run real-build
```

## 📄 License

This project is licensed under the [GNU GENERAL PUBLIC LICENSE](../LICENSE).

## 🤝 Contributing

Contributions are welcome! Please ensure:

1. Code follows the existing TypeScript patterns
2. All new code is properly typed
3. ESLint passes without errors
4. E2EE security is maintained for any messaging changes

## 📞 Support

For support, questions, or bug reports:

- Open an issue in the repository
- Contact the development team
- Check the [Backend API Documentation](../Backend/API.md) for API-related questions

## 🔗 Related Documentation

- [Backend API Documentation](../Backend/API.md) - Complete API reference
- [Mobile API Integration Guide](./API.md) - Detailed mobile API usage
