import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, AntDesign, FontAwesome } from '@expo/vector-icons';
import { useApp, useTranslation } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import { AuthUser } from '@/services/storage';

export default function LoginScreen() {
  const { user, isLoading, login, language, setLanguage } = useApp();
  const { t } = useTranslation();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [signingIn, setSigningIn] = useState(false);

  const isRTL = language === 'ar';

  useEffect(() => {
    if (!isLoading && user?.isLoggedIn) {
      router.replace('/home');
    }
  }, [isLoading, user]);

  const handleLogin = async () => {
    setSigningIn(true);
    // Simulate Google login
    await new Promise(resolve => setTimeout(resolve, 1500));
    const mockUser: AuthUser = {
      id: 'rbf_user_001',
      name: 'RBF Engineer',
      email: 'engineer@rbfworks.com',
      isLoggedIn: true,
    };
    await login(mockUser);
    setSigningIn(false);
    router.replace('/home');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.lg }]}>
      {/* Background */}
      <Image
        source={require('@/assets/images/hero-banner.png')}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={300}
      />
      <View style={styles.overlay} />

      {/* Language Toggle */}
      <View style={[styles.langRow, isRTL && styles.langRowRTL]}>
        <Pressable
          onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          style={({ pressed }) => [styles.langBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialIcons name="language" size={18} color={Colors.textOnPrimary} />
          <Text style={styles.langBtnText}>{language === 'en' ? 'العربية' : 'English'}</Text>
        </Pressable>
      </View>

      {/* Center Content */}
      <View style={styles.centerContent}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/rbf-logo-original.jpg')}
            style={styles.logo}
            contentFit="contain"
            transition={200}
          />
        </View>

        <Text style={styles.appName}>RBF Works</Text>
        <Text style={styles.tagline}>{t('appTagline')}</Text>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <View style={styles.dividerDot} />
          <View style={styles.dividerLine} />
        </View>

        {/* Mock Badge */}
        <View style={styles.mockBadge}>
          <MaterialIcons name="info-outline" size={14} color={Colors.accent} />
          <Text style={styles.mockText}>{t('mockLoginNote')}</Text>
        </View>

        {/* Login Title */}
        <Text style={[styles.loginTitle, isRTL && styles.rtlText]}>{t('loginTitle')}</Text>
        <Text style={[styles.loginSubtitle, isRTL && styles.rtlText]}>{t('loginSubtitle')}</Text>

        {/* Google Login Button */}
        <Pressable
          onPress={handleLogin}
          disabled={signingIn}
          style={({ pressed }) => [
            styles.googleBtn,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            signingIn && { opacity: 0.7 },
          ]}
        >
          {signingIn ? (
            <ActivityIndicator color={Colors.primary} size="small" />
          ) : (
            <AntDesign name="google" size={22} color="#EA4335" />
          )}
          <Text style={styles.googleBtnText}>
            {signingIn ? t('loading') : t('loginButton')}
          </Text>
        </Pressable>

        {/* Disclaimer */}
        <View style={[styles.disclaimerRow, isRTL && styles.rtlRow]}>
          <FontAwesome name="wifi" size={12} color="rgba(255,255,255,0.5)" />
          <Text style={[styles.disclaimer, isRTL && styles.rtlText]}>{t('loginDisclaimer')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.primary },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 50, 48, 0.72)',
  },
  langRow: {
    position: 'absolute',
    top: 56,
    right: Spacing.md,
    zIndex: 10,
  },
  langRowRTL: { right: undefined, left: Spacing.md },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  langBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: {
    width: 110,
    height: 110,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadow.lg,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  logo: { width: 90, height: 90 },
  appName: {
    fontSize: FontSize.hero,
    fontWeight: FontWeight.heavy,
    color: Colors.textOnPrimary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  tagline: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: FontWeight.medium,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: Spacing.lg,
    width: '60%',
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  dividerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.accent },
  mockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(46,196,182,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(46,196,182,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
  },
  mockText: { fontSize: FontSize.xs, color: Colors.accent, fontWeight: FontWeight.semibold, letterSpacing: 0.5 },
  loginTitle: {
    fontSize: FontSize.title,
    fontWeight: FontWeight.bold,
    color: Colors.textOnPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  loginSubtitle: {
    fontSize: FontSize.body,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    width: '100%',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadow.lg,
  },
  googleBtnText: {
    fontSize: FontSize.bodyLg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rtlRow: { flexDirection: 'row-reverse' },
  disclaimer: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
  rtlText: { textAlign: 'right' },
});
