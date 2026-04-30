import React from 'react';
import { TextInput, Text, View, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/constants/theme';

interface AppTextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  numberOfLines?: number;
  isRTL?: boolean;
  style?: ViewStyle;
  inputStyle?: TextStyle;
}

export function AppTextInput({
  label,
  value,
  onChangeText,
  placeholder,
  numberOfLines = 4,
  isRTL = false,
  style,
  inputStyle,
}: AppTextInputProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.label, isRTL && styles.rtlText]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline
        numberOfLines={numberOfLines}
        textAlignVertical="top"
        textAlign={isRTL ? 'right' : 'left'}
        style={[
          styles.input,
          { minHeight: numberOfLines * 28 },
          isRTL && styles.rtlInput,
          inputStyle,
        ]}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.md },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
    marginBottom: Spacing.xs,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontSize: FontSize.bodyLg,
    color: Colors.text,
    lineHeight: 26,
  },
  rtlText: { textAlign: 'right' },
  rtlInput: { textAlign: 'right', writingDirection: 'rtl' },
});
