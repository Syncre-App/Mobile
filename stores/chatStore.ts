import { create } from 'zustand';
import { Chat, Message, TypingUser, UnreadSummary } from '../types/chat';
import { chatApi } from '../services/api';

interface ChatState {
  // State
  chats: Chat[];
  messages: Record<number, Message[]>; // chatId -> messages
  typingUsers: TypingUser[];
  unreadSummary: UnreadSummary | null;
  activeChatId: number | null;
  isLoading: boolean;
  isLoadingMessages: boolean;
  hasMoreMessages: Record<number, boolean>;
  error: string | null;

  // Actions
  fetchChats: () => Promise<void>;
  fetchMessages: (chatId: number, loadMore?: boolean) => Promise<void>;
  fetchUnreadSummary: () => Promise<void>;
  setActiveChat: (chatId: number | null) => void;
  addMessage: (message: Message) => void;
  updateMessage: (chatId: number, messageId: number, updates: Partial<Message>) => void;
  deleteMessage: (chatId: number, messageId: number) => void;
  addTypingUser: (user: TypingUser) => void;
  removeTypingUser: (chatId: number, userId: number) => void;
  markChatAsRead: (chatId: number) => Promise<void>;
  updateChatLastMessage: (chatId: number, message: Message) => void;
  addChat: (chat: Chat) => void;
  updateChat: (chatId: number, updates: Partial<Chat>) => void;
  removeChat: (chatId: number) => void;
  clearError: () => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state
  chats: [],
  messages: {},
  typingUsers: [],
  unreadSummary: null,
  activeChatId: null,
  isLoading: false,
  isLoadingMessages: false,
  hasMoreMessages: {},
  error: null,

  // Fetch all chats
  fetchChats: async () => {
    try {
      set({ isLoading: true, error: null });
      const chats = await chatApi.getChats();
      set({ chats, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false, error: error.message || 'Failed to fetch chats' });
    }
  },

  // Fetch messages for a chat
  fetchMessages: async (chatId: number, loadMore = false) => {
    try {
      set({ isLoadingMessages: true, error: null });

      const { messages } = get();
      const existingMessages = messages[chatId] || [];
      
      let before: string | undefined;
      if (loadMore && existingMessages.length > 0) {
        // Get oldest message timestamp for pagination
        const oldestMessage = existingMessages[existingMessages.length - 1];
        before = oldestMessage.createdAt;
      }

      const response = await chatApi.getMessages(chatId, {
        before,
        limit: 20,
      });

      set(state => ({
        messages: {
          ...state.messages,
          [chatId]: loadMore
            ? [...existingMessages, ...response.messages]
            : response.messages,
        },
        hasMoreMessages: {
          ...state.hasMoreMessages,
          [chatId]: response.hasMore,
        },
        isLoadingMessages: false,
      }));
    } catch (error: any) {
      set({ isLoadingMessages: false, error: error.message || 'Failed to fetch messages' });
    }
  },

  // Fetch unread summary
  fetchUnreadSummary: async () => {
    try {
      const summary = await chatApi.getUnreadSummary();
      set({ unreadSummary: summary });
    } catch (error) {
      console.error('Failed to fetch unread summary:', error);
    }
  },

  // Set active chat
  setActiveChat: (chatId: number | null) => {
    set({ activeChatId: chatId });
  },

  // Add a new message
  addMessage: (message: Message) => {
    set(state => {
      const chatMessages = state.messages[message.chatId] || [];
      
      // Check if message already exists (by id or localId)
      const exists = chatMessages.some(
        m => m.id === message.id || (message.localId && m.localId === message.localId)
      );
      
      if (exists) {
        // Update existing message
        return {
          messages: {
            ...state.messages,
            [message.chatId]: chatMessages.map(m =>
              m.id === message.id || (message.localId && m.localId === message.localId)
                ? message
                : m
            ),
          },
        };
      }

      // Add new message at the beginning (newest first)
      return {
        messages: {
          ...state.messages,
          [message.chatId]: [message, ...chatMessages],
        },
      };
    });
  },

  // Update a message
  updateMessage: (chatId: number, messageId: number, updates: Partial<Message>) => {
    set(state => {
      const chatMessages = state.messages[chatId] || [];
      return {
        messages: {
          ...state.messages,
          [chatId]: chatMessages.map(m =>
            m.id === messageId ? { ...m, ...updates } : m
          ),
        },
      };
    });
  },

  // Delete a message
  deleteMessage: (chatId: number, messageId: number) => {
    set(state => {
      const chatMessages = state.messages[chatId] || [];
      return {
        messages: {
          ...state.messages,
          [chatId]: chatMessages.map(m =>
            m.id === messageId ? { ...m, isDeleted: true, deletedAt: new Date().toISOString() } : m
          ),
        },
      };
    });
  },

  // Add typing user
  addTypingUser: (user: TypingUser) => {
    set(state => {
      const filtered = state.typingUsers.filter(
        t => !(t.chatId === user.chatId && t.userId === user.userId)
      );
      return { typingUsers: [...filtered, user] };
    });

    // Auto-remove after timeout
    setTimeout(() => {
      get().removeTypingUser(user.chatId, user.userId);
    }, 3000);
  },

  // Remove typing user
  removeTypingUser: (chatId: number, userId: number) => {
    set(state => ({
      typingUsers: state.typingUsers.filter(
        t => !(t.chatId === chatId && t.userId === userId)
      ),
    }));
  },

  // Mark chat as read
  markChatAsRead: async (chatId: number) => {
    try {
      await chatApi.markChatSeen(chatId);
      
      // Update local unread count
      set(state => {
        if (!state.unreadSummary) return state;
        
        const chatUnread = state.unreadSummary.chats[chatId] || 0;
        return {
          unreadSummary: {
            total: state.unreadSummary.total - chatUnread,
            chats: {
              ...state.unreadSummary.chats,
              [chatId]: 0,
            },
          },
        };
      });
    } catch (error) {
      console.error('Failed to mark chat as read:', error);
    }
  },

  // Update chat's last message
  updateChatLastMessage: (chatId: number, message: Message) => {
    set(state => ({
      chats: state.chats.map(chat =>
        chat.id === chatId
          ? { ...chat, lastMessage: message, updated_at: message.createdAt }
          : chat
      ),
    }));
  },

  // Add a new chat
  addChat: (chat: Chat) => {
    set(state => {
      // Check if chat already exists
      if (state.chats.some(c => c.id === chat.id)) {
        return state;
      }
      return { chats: [chat, ...state.chats] };
    });
  },

  // Update a chat
  updateChat: (chatId: number, updates: Partial<Chat>) => {
    set(state => ({
      chats: state.chats.map(chat =>
        chat.id === chatId ? { ...chat, ...updates } : chat
      ),
    }));
  },

  // Remove a chat
  removeChat: (chatId: number) => {
    set(state => ({
      chats: state.chats.filter(chat => chat.id !== chatId),
      messages: Object.fromEntries(
        Object.entries(state.messages).filter(([id]) => parseInt(id) !== chatId)
      ),
    }));
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Reset store
  reset: () => {
    set({
      chats: [],
      messages: {},
      typingUsers: [],
      unreadSummary: null,
      activeChatId: null,
      isLoading: false,
      isLoadingMessages: false,
      hasMoreMessages: {},
      error: null,
    });
  },
}));
