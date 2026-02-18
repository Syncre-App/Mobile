import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { font, palette, radii, spacing } from '../theme/designSystem';
import { UserAvatar } from './UserAvatar';

interface FriendSummary {
  id: string;
  username: string;
  email?: string;
  profile_picture?: string | null;
  status?: string | null;
  last_seen?: string | null;
}

interface FriendRequestsWidgetProps {
  incoming: FriendSummary[];
  outgoing: FriendSummary[];
  onAccept: (friendId: string) => void;
  onReject: (friendId: string) => void;
  processingId?: string | null;
}

export const FriendRequestsWidget: React.FC<FriendRequestsWidgetProps> = ({
  incoming,
  outgoing,
  onAccept,
  onReject,
  processingId = null,
}) => {
  const hasRequests = incoming.length > 0 || outgoing.length > 0;
  if (!hasRequests) return null;

  const renderIncomingRequest = (request: FriendSummary) => {
    const isProcessing = processingId === request.id;

    const status = request.status ? request.status.toLowerCase() : '';
    const lastSeen = request.last_seen;
    const presenceLabel = (() => {
      if (status === 'online') return 'Online';
      if (status === 'idle') return 'Idle';
      if (!lastSeen) return '';
      const parsed = Date.parse(lastSeen);
      if (Number.isNaN(parsed)) return '';
      const diffMs = Date.now() - parsed;
      const minutes = Math.floor(diffMs / 60000);
      if (minutes < 3) return 'Idle';
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    })();

    return (
      <View key={request.id} style={styles.requestRow}>
        <UserAvatar
          uri={request.profile_picture}
          name={request.username || request.email}
          size={48}
          style={styles.requestAvatar}
        />
        <View style={styles.requestInfo}>
          <Text style={styles.requestName}>{request.username}</Text>
          {request.email ? (
            <Text style={styles.requestEmail}>{request.email}</Text>
          ) : null}
          {presenceLabel ? (
            <Text style={styles.requestPresence}>{presenceLabel}</Text>
          ) : null}
        </View>
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton, isProcessing && styles.disabledButton]}
            onPress={() => onAccept(request.id)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#0B1630" />
            ) : (
              <Text style={styles.actionButtonText}>Accept</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton, isProcessing && styles.disabledButton]}
            onPress={() => onReject(request.id)}
            disabled={isProcessing}
          >
            <Text style={[styles.actionButtonText, styles.rejectButtonText]}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderOutgoingRequest = (request: FriendSummary) => (
    <View key={request.id} style={styles.pendingRow}>
      <UserAvatar
        uri={request.profile_picture}
        name={request.username || request.email}
        size={44}
        style={styles.requestAvatar}
      />
      <View style={styles.requestInfo}>
        <Text style={styles.requestName}>{request.username}</Text>
        <Text style={styles.pendingText}>Awaiting approval</Text>
      </View>
      <Ionicons name="time-outline" size={18} color="rgba(255, 255, 255, 0.6)" />
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.label}>Social</Text>
          <Text style={styles.title}>Friend requests</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{incoming.length + outgoing.length}</Text>
        </View>
      </View>

      {incoming.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Incoming</Text>
          {incoming.map(renderIncomingRequest)}
        </View>
      )}

      {outgoing.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending</Text>
          {outgoing.map(renderOutgoingRequest)}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    color: palette.text,
    fontSize: 20,
    ...font('semibold'),
    letterSpacing: -0.2,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: palette.textSubtle,
    fontSize: 12,
    ...font('displayMedium'),
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: spacing.md,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  requestAvatar: {
    marginRight: spacing.md,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    color: palette.text,
    fontSize: 16,
    ...font('semibold'),
  },
  requestEmail: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  requestPresence: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  pendingText: {
    color: palette.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    borderRadius: radii.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: palette.accent,
  },
  rejectButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  disabledButton: {
    opacity: 0.75,
  },
  actionButtonText: {
    color: palette.text,
    fontSize: 14,
    ...font('semibold'),
  },
  rejectButtonText: {
    color: palette.error,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  label: {
    color: palette.textSubtle,
    ...font('displayMedium'),
    fontSize: 12,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: spacing.xxs,
  },
  badge: {
    minWidth: 36,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 1.5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    alignItems: 'center',
  },
  badgeText: {
    color: palette.accentSecondary,
    ...font('display'),
    fontSize: 14,
  },
});
