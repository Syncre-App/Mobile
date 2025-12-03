import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

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
  | 'jewish';

interface BadgeIconProps {
  type: BadgeType;
  size?: number;
  style?: ViewStyle;
}

const BADGE_COLORS: Record<BadgeType, string> = {
  staff: '#5865F2',
  developer: '#3BA55C',
  support: '#FAA61A',
  donator: '#F47FFF',
  early_access: '#5865F2',
  tester: '#747F8D',
  bug_hunter: '#ED4245',
  premium: '#FFD700',
  og: '#00D1FF',
  verified: '#38bdf8',
  bot: '#c4b5fd',
  jewish: '#C9A227',
};

const BadgeIcon: React.FC<BadgeIconProps> = ({ type, size = 16, style }) => {
  const color = BADGE_COLORS[type] || '#e5e7eb';

  const renderIcon = () => {
    switch (type) {
      case 'staff':
        return (
          <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <Circle cx="8" cy="8" r="7" fill={color} />
            <Path d="M8 3L9.5 6.5L13 7L10.5 9.5L11 13L8 11.5L5 13L5.5 9.5L3 7L6.5 6.5L8 3Z" fill="white" />
          </Svg>
        );

      case 'developer':
        return (
          <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <Circle cx="8" cy="8" r="7" fill={color} />
            <Path d="M5.5 6L4 8L5.5 10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M10.5 6L12 8L10.5 10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M9 5L7 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </Svg>
        );

      case 'support':
        return (
          <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <Circle cx="8" cy="8" r="7" fill={color} />
            <Circle cx="8" cy="6" r="2.5" fill="white" />
            <Path d="M4 12.5C4 10.5 5.8 9 8 9C10.2 9 12 10.5 12 12.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </Svg>
        );

      case 'donator':
        return (
          <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <Circle cx="8" cy="8" r="7" fill={color} />
            <Path d="M8 4.5C6.5 4.5 5 5.5 5 7C5 10 8 12 8 12C8 12 11 10 11 7C11 5.5 9.5 4.5 8 4.5Z" fill="white" />
          </Svg>
        );

      case 'early_access':
        return (
          <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <Circle cx="8" cy="8" r="7" fill={color} />
            <Path d="M5 8L7 10L11 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );

      case 'tester':
        return (
          <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <Circle cx="8" cy="8" r="7" fill={color} />
            <Path d="M6 5V11L10.5 8L6 5Z" fill="white" />
          </Svg>
        );

      case 'bug_hunter':
        return (
          <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <Circle cx="8" cy="8" r="7" fill={color} />
            <Path d="M8 4C6.5 4 5.5 5 5 6C5.5 6 6.5 6 7 7C7 8 6 9 5 9.5C6 10.5 7 11 8 11C10.2 11 12 9.2 12 7C12 5.5 10.5 4 8 4Z" fill="white" />
            <Circle cx="9.5" cy="6.5" r="0.75" fill={color} />
          </Svg>
        );

      case 'premium':
        return (
          <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <Circle cx="8" cy="8" r="7" fill={color} />
            <Path d="M8 3L9.76 5.85L13 6.58L10.76 9.15L11.18 12.47L8 11.13L4.82 12.47L5.24 9.15L3 6.58L6.24 5.85L8 3Z" fill="white" />
          </Svg>
        );

      case 'og':
        return (
          <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <Circle cx="8" cy="8" r="7" fill={color} />
            <Path d="M8 3.5V8L10.5 10.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx="8" cy="8" r="4.5" stroke="white" strokeWidth="1.5" fill="none" />
          </Svg>
        );

      case 'verified':
        return (
          <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <Circle cx="8" cy="8" r="7" fill={color} />
            <Path d="M5 8L7 10L11 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        );

      case 'bot':
        return (
          <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <Circle cx="8" cy="8" r="7" fill={color} />
            <Path d="M5 7H11V11C11 11.5523 10.5523 12 10 12H6C5.44772 12 5 11.5523 5 11V7Z" fill="white" />
            <Circle cx="6.5" cy="9" r="1" fill={color} />
            <Circle cx="9.5" cy="9" r="1" fill={color} />
            <Path d="M8 4V6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            <Circle cx="8" cy="4" r="1" fill="white" />
          </Svg>
        );

      case 'jewish':
        return (
          <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <Circle cx="8" cy="8" r="7" fill="#C9A227" />
            <Path d="M8 2L13 11H3L8 2Z" stroke="white" strokeWidth="1.2" fill="none" />
            <Path d="M8 14L3 5H13L8 14Z" stroke="white" strokeWidth="1.2" fill="none" />
          </Svg>
        );

      default:
        return (
          <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <Circle cx="8" cy="8" r="7" fill="#e5e7eb" />
          </Svg>
        );
    }
  };

  return <View style={[styles.container, style]}>{renderIcon()}</View>;
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
