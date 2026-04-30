import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  fullWidth = true,
}: AppButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? Colors.primary : '#fff'}
          size="small"
        />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, styles[`${variant}Text` as keyof typeof styles], textStyle]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    minHeight: 50,
    ...Shadow.sm,
  },
  fullWidth: { width: '100%' },
  primary: { backgroundColor: Colors.primary },
  accent: { backgroundColor: Colors.accent },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  ghost: { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  danger: { backgroundColor: Colors.error },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },

  label: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, letterSpacing: 0.3 },
  primaryText: { color: Colors.textOnPrimary },
  accentText: { color: Colors.textOnAccent },
  outlineText: { color: Colors.primary },
  ghostText: { color: Colors.primary },
  dangerText: { color: '#fff' },
});
