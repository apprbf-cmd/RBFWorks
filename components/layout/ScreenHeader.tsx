import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, StatusBar } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, FontWeight, Shadow } from '@/constants/theme';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  isRTL?: boolean;
  rightAction?: React.ReactNode;
}

export function ScreenHeader({ title, subtitle, showBack = true, isRTL, rightAction }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={[styles.row, isRTL && styles.rtlRow]}>
        {showBack ? (
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <MaterialIcons
              name={isRTL ? 'arrow-forward' : 'arrow-back'}
              size={24}
              color={Colors.textOnPrimary}
            />
          </Pressable>
        ) : (
          <View style={styles.spacer} />
        )}

        <View style={[styles.titleBlock, isRTL && styles.rtlTitle]}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.spacer}>
          {rightAction}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.primary,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    ...Shadow.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rtlRow: { flexDirection: 'row-reverse' },
  backBtn: {
    padding: Spacing.xs,
    borderRadius: 8,
  },
  titleBlock: { flex: 1, alignItems: 'center' },
  rtlTitle: { alignItems: 'center' },
  title: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 2,
  },
  spacer: { width: 40, alignItems: 'flex-end' },
});
