# Syncre Mobile

Syncre is a secure, cross-platform mobile communication application built with React Native and Expo. It focuses on privacy and security through end-to-end encryption for all communications.

## ✨ Features

- **Secure Messaging:** End-to-end encrypted one-on-one conversations.
- **User Authentication:** Secure user registration, login, and profile management.
- **Friend System:** Users can search for others, send friend requests, and manage their friend list.
- **Real-time Communication:** Utilizes WebSockets for instant message delivery.
- **Push Notifications:** Stay updated with new messages and friend requests even when the app is closed.
- **Cross-Platform:** Runs on iOS, Android, and Web from a single codebase.

## 🚀 Technologies Used

- **Framework:** [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/)
- **Routing:** [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation.
- **UI Components:** [NextUI](https://nextui.org/) for the user interface.
- **State Management & Data:** React Context and custom hooks.
- **Encryption:**
  - `@stablelib/hkdf`
  - `@stablelib/sha256`
  - `@stablelib/xchacha20poly1305`
  - `expo-crypto`
  - `tweetnacl`
- **Storage:** `AsyncStorage` and `Expo Secure Store` for persistent and secure data storage.
- **Real-time:** WebSockets
- **Linting:** ESLint
- **Typing:** TypeScript

## 🏁 Getting Started

### Prerequisites

- Node.js (LTS version recommended)
- npm or pnpm
- Expo Go app on your mobile device for development, or Android Studio/Xcode for emulators.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd Mobile
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    pnpm install
    ```

## 📜 Available Scripts

-   **`npm start`**: Starts the development server with Expo.
-   **`npm run android`**: Runs the app on a connected Android device or emulator.
-   **`npm run ios`**: Runs the app on an iOS simulator or connected device.
-   **`npm run web`**: Runs the app in a web browser.
-   **`npm run lint`**: Lints the codebase using ESLint.
-   **`npm run build`**: Creates a production build for iOS using EAS Build and submits it.
-   **`npm run real-build`**: Creates release builds for both iOS and Android.

## 📁 Project Structure

```
.
├── app/                # Expo Router routes (screens)
│   ├── chat/           # Dynamic route for individual chats
│   ├── _layout.tsx     # Main layout
│   ├── index.tsx       # Login/entry screen
│   └── ...             # Other screens (profile, settings, etc.)
├── assets/             # Static assets (images, fonts)
├── components/         # Reusable UI components
├── context/            # React context providers
├── hooks/              # Custom React hooks
├── services/           # Core services (API, Crypto, WebSocket, etc.)
├── screens/            # (Potentially legacy) Screen components
└── ...                 # Config files, etc.
```

## 📄 License

This project is licensed under the [GNU GENERAL PUBLIC LICENSE](LICENSE).