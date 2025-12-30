import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  GestureResponderEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import { Avatar } from '../ui';
import { Layout } from '../../constants/layout';
import { Message, MessageReaction } from '../../types/chat';
import { format } from 'date-fns';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  onPress?: () => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  onDoubleTap?: () => void;
  onReactionPress?: (reaction: string) => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isOwnMessage,
  showAvatar = true,
  showTimestamp = false,
  onPress,
  onLongPress,
  onDoubleTap,
  onReactionPress,
}: MessageBubbleProps) {
  const { colors } = useTheme();

  const lastTap = React.useRef<number>(0);

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap
      onDoubleTap?.();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
      setTimeout(() => {
        if (lastTap.current !== 0) {
          onPress?.();
          lastTap.current = 0;
        }
      }, 300);
    }
  };

  const handleLongPress = (event: GestureResponderEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onLongPress?.(event);
  };

  const bubbleStyle = isOwnMessage
    ? { backgroundColor: colors.messageSent }
    : { backgroundColor: colors.messageReceived };

  const textStyle = isOwnMessage
    ? { color: colors.messageSentText }
    : { color: colors.messageReceivedText };

  // Render deleted message
  if (message.isDeleted) {
    return (
      <View style={[styles.container, isOwnMessage && styles.containerOwn]}>
        {!isOwnMessage && showAvatar && <View style={styles.avatarPlaceholder} />}
        <View style={[styles.deletedBubble, { backgroundColor: colors.surface }]}>
          <Ionicons name="trash-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.deletedText, { color: colors.textSecondary }]}>
            Message deleted
          </Text>
        </View>
      </View>
    );
  }

  // Render reply preview
  const renderReply = () => {
    if (!message.reply) return null;

    return (
      <View style={[styles.replyContainer, { backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)' }]}>
        <View style={[styles.replyBar, { backgroundColor: isOwnMessage ? '#FFFFFF' : colors.accent }]} />
        <View style={styles.replyContent}>
          <Text style={[styles.replyName, { color: isOwnMessage ? 'rgba(255,255,255,0.8)' : colors.accent }]}>
            {message.reply.senderLabel}
          </Text>
          <Text style={[styles.replyText, textStyle]} numberOfLines={1}>
            {message.reply.preview}
          </Text>
        </View>
      </View>
    );
  };

  // Render attachments
  const renderAttachments = () => {
    if (!message.attachments || message.attachments.length === 0) return null;

    return (
      <View style={styles.attachments}>
        {message.attachments.map(attachment => {
          if (attachment.isImage) {
            return (
              <Image
                key={attachment.id}
                source={{ uri: attachment.previewPath }}
                style={styles.attachmentImage}
                contentFit="cover"
                transition={200}
              />
            );
          }
          return (
            <View key={attachment.id} style={[styles.attachmentFile, { backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.15)' : colors.surface }]}>
              <Ionicons name="document-outline" size={20} color={isOwnMessage ? '#FFFFFF' : colors.text} />
              <Text style={[styles.attachmentName, { color: isOwnMessage ? '#FFFFFF' : colors.text }]} numberOfLines={1}>
                {attachment.name}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  // Render reactions
  const renderReactions = () => {
    if (!message.reactions || message.reactions.length === 0) return null;

    return (
      <View style={[styles.reactionsContainer, isOwnMessage && styles.reactionsOwn]}>
        {message.reactions.map((reaction, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.reactionBubble, { backgroundColor: colors.surface }]}
            onPress={() => onReactionPress?.(reaction.reaction)}
          >
            <Text style={styles.reactionEmoji}>{reaction.reaction}</Text>
            {reaction.count > 1 && (
              <Text style={[styles.reactionCount, { color: colors.textSecondary }]}>
                {reaction.count}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Render seen indicator
  const renderSeenIndicator = () => {
    if (!isOwnMessage) return null;

    if (message.seenBy && message.seenBy.length > 0) {
      return <Ionicons name="checkmark-done" size={14} color={colors.accent} style={styles.seenIcon} />;
    }
    if (message.deliveredAt) {
      return <Ionicons name="checkmark-done" size={14} color={colors.textSecondary} style={styles.seenIcon} />;
    }
    if (message.pending) {
      return <Ionicons name="time-outline" size={14} color={colors.textSecondary} style={styles.seenIcon} />;
    }
    return <Ionicons name="checkmark" size={14} color={colors.textSecondary} style={styles.seenIcon} />;
  };

  return (
    <View style={[styles.wrapper, showTimestamp && styles.wrapperWithTimestamp]}>
      {showTimestamp && (
        <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
          {format(new Date(message.createdAt), 'h:mm a')}
        </Text>
      )}
      
      <View style={[styles.container, isOwnMessage && styles.containerOwn]}>
        {!isOwnMessage && showAvatar && (
          <Avatar source={message.senderAvatar} name={message.senderName} size="sm" />
        )}
        {!isOwnMessage && !showAvatar && <View style={styles.avatarPlaceholder} />}

        <Pressable
          style={[
            styles.bubble,
            bubbleStyle,
            isOwnMessage ? styles.bubbleOwn : styles.bubbleOther,
            message.pending && styles.bubblePending,
            message.failed && styles.bubbleFailed,
          ]}
          onPress={handlePress}
          onLongPress={handleLongPress}
        >
          {renderReply()}
          {renderAttachments()}
          
          {message.content && (
            <Text style={[styles.messageText, textStyle]}>
              {message.content}
            </Text>
          )}

          <View style={styles.footer}>
            {message.editedAt && (
              <Text style={[styles.editedText, { color: isOwnMessage ? 'rgba(255,255,255,0.6)' : colors.textSecondary }]}>
                edited
              </Text>
            )}
            {renderSeenIndicator()}
          </View>
        </Pressable>
      </View>

      {renderReactions()}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 2,
  },
  wrapperWithTimestamp: {
    marginTop: Layout.spacing.md,
  },
  timestamp: {
    fontSize: Layout.fontSize.xs,
    textAlign: 'center',
    marginBottom: Layout.spacing.sm,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Layout.spacing.md,
  },
  containerOwn: {
    flexDirection: 'row-reverse',
  },
  avatarPlaceholder: {
    width: 32,
    marginRight: Layout.spacing.sm,
  },
  bubble: {
    maxWidth: Layout.message.maxWidth,
    paddingHorizontal: Layout.message.padding.horizontal,
    paddingVertical: Layout.message.padding.vertical,
    borderRadius: Layout.message.borderRadius,
    marginHorizontal: Layout.spacing.sm,
  },
  bubbleOwn: {
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    borderBottomLeftRadius: 4,
  },
  bubblePending: {
    opacity: 0.7,
  },
  bubbleFailed: {
    opacity: 0.5,
  },
  messageText: {
    fontSize: Layout.fontSize.md,
    lineHeight: 20,
  },
  deletedBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.message.borderRadius,
    marginHorizontal: Layout.spacing.sm,
  },
  deletedText: {
    fontSize: Layout.fontSize.sm,
    fontStyle: 'italic',
    marginLeft: Layout.spacing.xs,
  },
  replyContainer: {
    flexDirection: 'row',
    borderRadius: Layout.radius.sm,
    padding: Layout.spacing.sm,
    marginBottom: Layout.spacing.sm,
  },
  replyBar: {
    width: 3,
    borderRadius: 2,
    marginRight: Layout.spacing.sm,
  },
  replyContent: {
    flex: 1,
  },
  replyName: {
    fontSize: Layout.fontSize.xs,
    fontWeight: Layout.fontWeight.semibold,
    marginBottom: 2,
  },
  replyText: {
    fontSize: Layout.fontSize.sm,
  },
  attachments: {
    marginBottom: Layout.spacing.sm,
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: Layout.radius.md,
    marginBottom: Layout.spacing.xs,
  },
  attachmentFile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.spacing.md,
    paddingVertical: Layout.spacing.sm,
    borderRadius: Layout.radius.sm,
    marginBottom: Layout.spacing.xs,
  },
  attachmentName: {
    fontSize: Layout.fontSize.sm,
    marginLeft: Layout.spacing.sm,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  editedText: {
    fontSize: 10,
    marginRight: Layout.spacing.xs,
  },
  seenIcon: {
    marginLeft: 2,
  },
  reactionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Layout.spacing.md + 32 + Layout.spacing.sm,
    marginTop: 4,
  },
  reactionsOwn: {
    justifyContent: 'flex-end',
    paddingHorizontal: Layout.spacing.md,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 4,
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 11,
    marginLeft: 2,
  },
});
