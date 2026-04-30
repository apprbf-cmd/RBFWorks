import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';

interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  isRTL?: boolean;
}

export function SectionCard({ title, children, style, isRTL }: SectionCardProps) {
  return (
    <View style={[styles.card, style]}>
      {title ? (
        <View style={[styles.titleRow, isRTL && styles.rtlRow]}>
          <View style={styles.titleAccent} />
          <Text style={[styles.title, isRTL && styles.rtlText]}>{title}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadow.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rtlRow: { flexDirection: 'row-reverse' },
  titleAccent: {
    width: 4,
    height: 20,
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  title: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  rtlText: { textAlign: 'right' },
});
