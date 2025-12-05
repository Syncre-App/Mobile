import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

import StaffBadge from '../assets/badges/staff.svg';
import DeveloperBadge from '../assets/badges/developer.svg';
import SupportBadge from '../assets/badges/support.svg';
import DonatorBadge from '../assets/badges/donator.svg';
import EarlyAccessBadge from '../assets/badges/early_access.svg';
import TesterBadge from '../assets/badges/tester.svg';
import BugHunterBadge from '../assets/badges/bug_hunter.svg';
import PremiumBadge from '../assets/badges/premium.svg';
import OgBadge from '../assets/badges/og.svg';
import VerifiedBadge from '../assets/badges/verified.svg';
import BotBadge from '../assets/badges/bot.svg';
import SystemBadge from '../assets/badges/system.svg';
import JewishBadge from '../assets/badges/jewish.svg';

export type BadgeType =
  | 'staff'
  | 'developer'
  | 'support'
  | 'donator'
  | 'early_access'
  | 'tester'
  | 'bug_hunter'
  | 'premium'
  | 'og'
  | 'verified'
  | 'bot'
  | 'system'
  | 'jewish';

interface BadgeIconProps {
  type: BadgeType;
  size?: number;
  style?: ViewStyle;
}

const BADGE_COMPONENTS: Record<BadgeType, React.FC<{ width: number; height: number }>> = {
  staff: StaffBadge,
  developer: DeveloperBadge,
  support: SupportBadge,
  donator: DonatorBadge,
  early_access: EarlyAccessBadge,
  tester: TesterBadge,
  bug_hunter: BugHunterBadge,
  premium: PremiumBadge,
  og: OgBadge,
  verified: VerifiedBadge,
  bot: BotBadge,
  system: SystemBadge,
  jewish: JewishBadge,
};

const BadgeIcon: React.FC<BadgeIconProps> = ({ type, size = 16, style }) => {
  const BadgeComponent = BADGE_COMPONENTS[type];

  if (!BadgeComponent) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <BadgeComponent width={size} height={size} />
    </View>
  );
};

interface BadgeRowProps {
  badges: string[];
  size?: number;
  spacing?: number;
  style?: ViewStyle;
}

export const BadgeRow: React.FC<BadgeRowProps> = ({ badges, size = 14, spacing = 3, style }) => {
  if (!badges || badges.length === 0) return null;

  return (
    <View style={[styles.row, { gap: spacing }, style]}>
      {badges.map((badge, index) => (
        <BadgeIcon
          key={`${badge}-${index}`}
          type={badge as BadgeType}
          size={size}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default BadgeIcon;
