import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppBackground } from '../../components/AppBackground';
import { GlassCard } from '../../components/GlassCard';
import { UserAvatar } from '../../components/UserAvatar';
import { layout, palette, radii, spacing } from '../../theme/designSystem';
import { ApiService } from '../../services/ApiService';
import { StorageService } from '../../services/StorageService';
import { UserCacheService } from '../../services/UserCacheService';
import Svg, { Defs, LinearGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import * as FileSystem from 'expo-file-system';

type TopContact = {
  userId: string;
  username?: string | null;
  profile_picture?: string | null;
  badges?: string[];
  status?: string | null;
  count: number;
};

type DailyWrap = {
  statDate: string;
  messagesSent: number;
  messagesReceived: number;
  totalMessages: number;
  topContacts: TopContact[];
  hourHistogram: number[];
};

const formatDateLabel = (dateStr?: string) => {
  if (!dateStr) return '';
  const date = new Date(`${dateStr}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function DailyWrapScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const targetDate = Array.isArray(date) ? date[0] : date;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wrap, setWrap] = useState<DailyWrap | null>(null);
  const shareSvgRef = useRef<any>(null);

  const fetchWrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        setError('Hiányzik az authentikáció.');
        setLoading(false);
        return;
      }
      const response = await ApiService.getDailyWrap(targetDate, token);
      if (response.success && response.data?.stats) {
        const stats = response.data.stats;
        const normalized: DailyWrap = {
          statDate: stats.statDate || stats.date || targetDate || '',
          messagesSent: Number(stats.messagesSent ?? stats.messages_sent ?? 0),
          messagesReceived: Number(stats.messagesReceived ?? stats.messages_received ?? 0),
          totalMessages: Number(stats.totalMessages ?? stats.total_messages ?? 0),
          topContacts: Array.isArray(stats.topContacts ?? stats.top_contacts)
            ? (stats.topContacts ?? stats.top_contacts)
            : [],
          hourHistogram: Array.isArray(stats.hourHistogram ?? stats.hour_histogram)
            ? (stats.hourHistogram ?? stats.hour_histogram)
            : [],
        };
        if (normalized.topContacts?.length) {
          UserCacheService.addUsers(
            normalized.topContacts.map((c: any) => ({
              ...c,
              id: c.userId || c.userid || c.id,
            }))
          );
        }
        setWrap(normalized);
      } else {
        setError(response.error || 'Nem sikerült betölteni a wrapet.');
      }
    } catch (err: any) {
      setError(err?.message || 'Nem sikerült betölteni a wrapet.');
    } finally {
      setLoading(false);
    }
  }, [targetDate]);

  useEffect(() => {
    fetchWrap();
  }, [fetchWrap]);

  const maxHourValue = useMemo(() => {
    if (!wrap?.hourHistogram?.length) return 0;
    return Math.max(...wrap.hourHistogram);
  }, [wrap?.hourHistogram]);

  const handleShare = useCallback(async () => {
    if (!wrap) return;
    try {
      const svgNode: any = shareSvgRef.current;
      if (!svgNode || typeof svgNode.toDataURL !== 'function') {
        setError('A megosztás nem elérhető ezen az eszközön.');
        return;
      }
      const dataUrl: string = await new Promise((resolve) => svgNode.toDataURL(resolve));
      const base64 = dataUrl.replace('data:image/png;base64,', '');
      const fileUri = `${FileSystem.cacheDirectory}wrap-${wrap.statDate || 'today'}.png`;
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Share.share({
        url: fileUri,
        message: `Napi wrap (${wrap.statDate}): ${wrap.totalMessages} üzenet 🌟`,
      });
    } catch (err: any) {
      setError(err?.message || 'Nem sikerült megosztani a wrapet.');
    }
  }, [wrap]);

  const renderHourChart = () => {
    if (!wrap?.hourHistogram?.length) {
      return <Text style={styles.muted}>Nincs aktivitás erre a napra.</Text>;
    }
    const bars = wrap.hourHistogram.slice(0, 24);
    return (
      <View style={styles.chartContainer}>
        {bars.map((value, idx) => {
          const height =
            maxHourValue > 0 ? Math.max(6, (value / maxHourValue) * 110) : 6;
          return (
            <View key={`bar-${idx}`} style={styles.chartBarWrapper}>
              <View style={[styles.chartBar, { height }]} />
              <Text style={styles.chartLabel}>{idx}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  const renderTopContacts = () => {
    if (!wrap?.topContacts?.length) {
      return <Text style={styles.muted}>Nem volt aktivitás.</Text>;
    }
    return wrap.topContacts.map((contact) => {
      const id = contact.userId || contact.id;
      return (
        <View key={id} style={styles.topContactRow}>
          <UserAvatar
            uri={contact.profile_picture}
            name={contact.username || 'Ismeretlen'}
            size={46}
          />
          <View style={styles.topContactBody}>
            <Text style={styles.topContactName}>{contact.username || 'Ismeretlen'}</Text>
            <Text style={styles.topContactCount}>{contact.count} üzenet</Text>
          </View>
        </View>
      );
    });
  };

  return (
    <View style={styles.container}>
      <AppBackground />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Napi Wrap</Text>
        <Text style={styles.subtitle}>{formatDateLabel(wrap?.statDate || targetDate)}</Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={palette.accent} />
            <Text style={styles.muted}>Összegyűjtjük a statokat...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchWrap}>
              <Text style={styles.retryText}>Próbáld újra</Text>
            </TouchableOpacity>
          </View>
        ) : wrap ? (
          <>
            <GlassCard width="100%" style={styles.card}>
              <View style={styles.statRow}>
                <View style={styles.statBlock}>
                  <Text style={styles.statLabel}>Összes üzenet</Text>
                  <Text style={styles.statValue}>{wrap.totalMessages}</Text>
                </View>
                <View style={styles.statBlock}>
                  <Text style={styles.statLabel}>Küldött</Text>
                  <Text style={styles.statValue}>{wrap.messagesSent}</Text>
                </View>
                <View style={styles.statBlock}>
                  <Text style={styles.statLabel}>Kapott</Text>
                  <Text style={styles.statValue}>{wrap.messagesReceived}</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top 5</Text>
                {renderTopContacts()}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Aktivitás óránként</Text>
                {renderHourChart()}
              </View>
            </GlassCard>

            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Text style={styles.shareButtonText}>Megosztás menő kártyával</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>

      {/* Hidden SVG template for share card */}
      {wrap ? (
        <Svg
          ref={shareSvgRef}
          width={900}
          height={1600}
          style={{ position: 'absolute', left: -9999, top: -9999 }}
        >
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#111827" stopOpacity="1" />
              <Stop offset="1" stopColor="#1e3a8a" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="900" height="1600" fill="url(#grad)" rx="48" />
          <SvgText
            x="60"
            y="140"
            fill="#9CA3AF"
            fontSize="42"
            fontWeight="600"
          >{`syncre • ${wrap.statDate}`}</SvgText>
          <SvgText x="60" y="230" fill="#FFFFFF" fontSize="64" fontWeight="700">
            Napi Wrap
          </SvgText>
          <SvgText x="60" y="320" fill="#FFFFFF" fontSize="120" fontWeight="800">
            {wrap.totalMessages} üzenet
          </SvgText>
          <SvgText x="60" y="400" fill="#9CA3AF" fontSize="40" fontWeight="500">
            {`Küldött: ${wrap.messagesSent} • Kapott: ${wrap.messagesReceived}`}
          </SvgText>
          <SvgText x="60" y="500" fill="#FFFFFF" fontSize="48" fontWeight="700">
            Top beszélgetések
          </SvgText>
          {(wrap.topContacts || []).slice(0, 5).map((contact, idx) => (
            <SvgText
              key={`c-${contact.userId}-${idx}`}
              x="60"
              y={580 + idx * 70}
              fill="#E5E7EB"
              fontSize="38"
              fontWeight="600"
            >
              {`${idx + 1}. ${contact.username || 'Ismeretlen'} — ${contact.count} üzi`}
            </SvgText>
          ))}
          <SvgText x="60" y="980" fill="#FFFFFF" fontSize="48" fontWeight="700">
            Aktivitás
          </SvgText>
          <SvgText x="60" y="1040" fill="#9CA3AF" fontSize="32">
            Legpörgősebb óra: {wrap.hourHistogram?.length ? wrap.hourHistogram.indexOf(maxHourValue) : 0}:00
          </SvgText>
          <SvgText x="60" y="1500" fill="#9CA3AF" fontSize="34">
            Oszd meg a napi wrappedet a barátokkal! @syncre
          </SvgText>
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  title: {
    color: palette.text,
    fontSize: 28,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 15,
    marginBottom: spacing.lg,
  },
  loadingBox: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorBox: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    color: palette.error,
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: palette.accent,
    borderRadius: radii.lg,
  },
  retryText: {
    color: palette.text,
    fontWeight: '600',
  },
  card: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    gap: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statBlock: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statLabel: {
    color: palette.textMuted,
    fontSize: 13,
    marginBottom: spacing.xs / 2,
  },
  statValue: {
    color: palette.text,
    fontSize: 22,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  section: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontFamily: 'PlusJakartaSans-SemiBold',
    marginBottom: spacing.sm,
  },
  topContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  topContactBody: {
    flex: 1,
  },
  topContactName: {
    color: palette.text,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
  topContactCount: {
    color: palette.textMuted,
    fontSize: 13,
  },
  muted: {
    color: palette.textMuted,
    fontSize: 14,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  chartBarWrapper: {
    alignItems: 'center',
    width: 16,
  },
  chartBar: {
    width: 12,
    borderRadius: 6,
    backgroundColor: palette.accent,
  },
  chartLabel: {
    color: palette.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  shareButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: palette.accent,
  },
  shareButtonText: {
    color: palette.text,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-SemiBold',
  },
});
