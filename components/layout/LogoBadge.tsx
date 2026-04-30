import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Colors, Radius, FontSize, FontWeight } from '@/constants/theme';

interface LogoBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  light?: boolean;
}

export function LogoBadge({ size = 'md', showName = true, light = false }: LogoBadgeProps) {
  const dim = size === 'sm' ? 36 : size === 'md' ? 56 : 80;

  return (
    <View style={styles.container}>
      <View style={[styles.logoWrap, { width: dim, height: dim, borderRadius: dim / 4 }]}>
        <Image
          source={require('@/assets/images/rbf-logo.png')}
          style={{ width: dim, height: dim, borderRadius: dim / 4 }}
          contentFit="contain"
          transition={200}
        />
      </View>
      {showName ? (
        <View>
          <Text style={[styles.name, light && styles.nameLight]}>RBF Works</Text>
          <Text style={[styles.tagline, light && styles.taglineLight]}>Engineering Excellence</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoWrap: {
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  name: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  nameLight: { color: Colors.textOnPrimary },
  tagline: { fontSize: FontSize.xs, color: Colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  taglineLight: { color: 'rgba(255,255,255,0.65)' },
});
