import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { font, palette, radii, spacing } from '../theme/designSystem';
import { UserAvatar } from './UserAvatar';

interface PollVoter {
  userId: string;
  username: string;
  profilePicture?: string | null;
}

interface PollVoteData {
  optionId: number;
  count: number;
  voters: PollVoter[];
}

interface PollOption {
  id: number;
  text: string;
}

export interface PollData {
  id: number;
  messageId: number;
  chatId: number;
  creatorId: string;
  question: string;
  options: PollOption[];
  multiSelect: boolean;
  isClosed: boolean;
  votes: PollVoteData[];
  totalVotes: number;
}

interface PollMessageProps {
  poll: PollData;
  userVotes: number[];
  onVote: (optionId: number) => void;
  onRemoveVote: (optionId: number) => void;
  onClose?: () => void;
  isCreator: boolean;
  isLoading?: boolean;
}

export const PollMessage: React.FC<PollMessageProps> = ({
  poll,
  userVotes,
  onVote,
  onRemoveVote,
  onClose,
  isCreator,
  isLoading = false,
}) => {
  const totalVotes = useMemo(() => {
    return poll.votes.reduce((sum, v) => sum + v.count, 0);
  }, [poll.votes]);

  const getVoteCount = useCallback((optionId: number) => {
    const vote = poll.votes.find((v) => v.optionId === optionId);
    return vote?.count || 0;
  }, [poll.votes]);

  const getVoters = useCallback((optionId: number) => {
    const vote = poll.votes.find((v) => v.optionId === optionId);
    return vote?.voters || [];
  }, [poll.votes]);

  const getPercentage = useCallback((optionId: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((getVoteCount(optionId) / totalVotes) * 100);
  }, [totalVotes, getVoteCount]);

  const handleOptionPress = useCallback((optionId: number) => {
    if (poll.isClosed || isLoading) return;

    const isVoted = userVotes.includes(optionId);

    if (isVoted) {
      onRemoveVote(optionId);
    } else {
      if (!poll.multiSelect && userVotes.length > 0) {
        // Single select - remove previous vote first (handled by API)
      }
      onVote(optionId);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [poll.isClosed, poll.multiSelect, userVotes, onVote, onRemoveVote, isLoading]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="stats-chart" size={18} color={palette.accent} />
        <Text style={styles.questionText}>{poll.question}</Text>
      </View>

      {poll.multiSelect && !poll.isClosed && (
        <Text style={styles.multiSelectHint}>Multiple answers allowed</Text>
      )}

      <View style={styles.optionsContainer}>
        {poll.options.map((option) => {
          const isVoted = userVotes.includes(option.id);
          const voteCount = getVoteCount(option.id);
          const percentage = getPercentage(option.id);
          const voters = getVoters(option.id);

          return (
            <Pressable
              key={option.id}
              style={[
                styles.optionButton,
                isVoted && styles.optionButtonVoted,
                poll.isClosed && styles.optionButtonClosed,
              ]}
              onPress={() => handleOptionPress(option.id)}
              disabled={poll.isClosed || isLoading}
            >
              <View
                style={[
                  styles.optionProgress,
                  { width: `${percentage}%` },
                  isVoted && styles.optionProgressVoted,
                ]}
              />
              <View style={styles.optionContent}>
                <View style={styles.optionLeft}>
                  <View style={[styles.radioCircle, isVoted && styles.radioCircleChecked]}>
                    {isVoted && <Ionicons name="checkmark" size={12} color="#ffffff" />}
                  </View>
                  <Text style={[styles.optionText, isVoted && styles.optionTextVoted]}>
                    {option.text}
                  </Text>
                </View>
                <View style={styles.optionRight}>
                  {voters.length > 0 && (
                    <View style={styles.voterAvatars}>
                      {voters.slice(0, 3).map((voter, i) => (
                        <UserAvatar
                          key={voter.userId}
                          uri={voter.profilePicture || undefined}
                          name={voter.username}
                          size={18}
                          style={[styles.voterAvatar, { marginLeft: i > 0 ? -6 : 0 }]}
                        />
                      ))}
                    </View>
                  )}
                  <Text style={styles.voteCount}>
                    {voteCount} ({percentage}%)
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.totalVotes}>
          {totalVotes} votes
        </Text>
        {poll.isClosed ? (
          <View style={styles.closedBadge}>
            <Ionicons name="lock-closed" size={12} color="#EF4444" />
            <Text style={styles.closedText}>Closed</Text>
          </View>
        ) : isCreator && onClose ? (
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close poll</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radii.lg,
    padding: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  questionText: {
    flex: 1,
    color: palette.text,
    fontSize: 15,
    ...font('semibold'),
    lineHeight: 20,
  },
  multiSelectHint: {
    color: palette.textMuted,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  optionsContainer: {
    gap: spacing.xs,
  },
  optionButton: {
    position: 'relative',
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  optionButtonVoted: {
    borderWidth: 1,
    borderColor: palette.accent,
  },
  optionButtonClosed: {
    opacity: 0.8,
  },
  optionProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radii.md,
  },
  optionProgressVoted: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    zIndex: 1,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleChecked: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  optionText: {
    color: palette.text,
    fontSize: 14,
    flex: 1,
  },
  optionTextVoted: {
    ...font('semibold'),
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  voterAvatars: {
    flexDirection: 'row',
  },
  voterAvatar: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.5)',
  },
  voteCount: {
    color: palette.textMuted,
    fontSize: 12,
    minWidth: 50,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  totalVotes: {
    color: palette.textMuted,
    fontSize: 12,
  },
  closedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  closedText: {
    color: '#EF4444',
    fontSize: 11,
    ...font('medium'),
  },
  closeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  closeButtonText: {
    color: palette.textMuted,
    fontSize: 11,
  },
});

export default PollMessage;
