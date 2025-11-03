import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { GlassCard } from './GlassCard';

interface FriendSummary {
  id: string;
  username: string;
  email?: string;
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

    return (
      <View key={request.id} style={styles.requestRow}>
        <View style={styles.requestInfo}>
          <Text style={styles.requestName}>{request.username}</Text>
          {request.email ? (
            <Text style={styles.requestEmail}>{request.email}</Text>
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
      <View style={styles.requestInfo}>
        <Text style={styles.requestName}>{request.username}</Text>
        <Text style={styles.pendingText}>Awaiting approval</Text>
      </View>
      <Ionicons name="time-outline" size={18} color="rgba(255, 255, 255, 0.6)" />
    </View>
  );

  return (
    <GlassCard width="100%" style={styles.card}>
      <Text style={styles.title}>Friend Requests</Text>

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
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    gap: 12,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  requestEmail: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    marginTop: 2,
  },
  pendingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#2C82FF',
  },
  rejectButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  disabledButton: {
    opacity: 0.75,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButtonText: {
    color: '#ff6b6b',
  },
});

