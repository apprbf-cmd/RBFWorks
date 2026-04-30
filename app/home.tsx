import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useApp, useTranslation } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';

interface Department {
  id: string;
  icon: React.ReactNode;
  color: string;
  route?: string;
  comingSoon?: boolean;
}

export default function HomeScreen() {
  const { user, logout, language, setLanguage, isRTL } = useApp();
  const { t } = useTranslation();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const departments: Department[] = [
    {
      id: 'execution',
      icon: <MaterialCommunityIcons name="hard-hat" size={32} color={Colors.primary} />,
      color: Colors.primary,
      route: '/execution',
    },
    {
      id: 'engineering',
      icon: <MaterialCommunityIcons name="drawing" size={32} color="#148A7F" />,
      color: '#148A7F',
      comingSoon: true,
    },
    {
      id: 'procurement',
      icon: <MaterialCommunityIcons name="truck-delivery" size={32} color="#2E7D32" />,
      color: '#1B5E3B',
      comingSoon: true,
    },
    {
      id: 'quality',
      icon: <MaterialCommunityIcons name="clipboard-check" size={32} color="#FB8C00" />,
      color: '#7C3D02',
      comingSoon: true,
    },
    {
      id: 'hr',
      icon: <MaterialCommunityIcons name="account-group" size={32} color="#E53935" />,
      color: '#7B1F1F',
      comingSoon: true,
    },
    {
      id: 'finance',
      icon: <MaterialCommunityIcons name="finance" size={32} color="#0E7A70" />,
      color: '#0E7A70',
      comingSoon: true,
    },
  ];

  const getDeptName = (id: string) => {
    if (id === 'execution') {
      return language === 'ar' ? `${t('executionDept')}\n${t('executionDeptAr')}` : `${t('executionDept')}\n${t('executionDeptAr')}`;
    }
    const names: Record<string, { en: string; ar: string }> = {
      engineering: { en: 'Engineering', ar: 'قسم الهندسة' },
      procurement: { en: 'Procurement', ar: 'قسم المشتريات' },
      quality: { en: 'Quality Control', ar: 'ضبط الجودة' },
      hr: { en: 'Human Resources', ar: 'الموارد البشرية' },
      finance: { en: 'Finance', ar: 'قسم المالية' },
    };
    const n = names[id];
    if (!n) return id;
    return `${n.en}\n${n.ar}`;
  };

  const handleDeptPress = (dept: Department) => {
    if (dept.comingSoon) {
      showAlert(t('comingSoon'), language === 'ar' ? 'سيتم إضافة هذا القسم قريباً' : 'This department will be added soon.');
      return;
    }
    if (dept.route) router.push(dept.route as any);
  };

  const handleLogout = () => {
    showAlert(
      language === 'ar' ? 'تسجيل الخروج' : 'Logout',
      language === 'ar' ? 'هل تريد تسجيل الخروج؟' : 'Are you sure you want to logout?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('logout'),
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerRow, isRTL && styles.rtlRow]}>
          <View style={styles.logoRow}>
            <View style={styles.logoWrap}>
              <Image
                source={require('@/assets/images/rbf-logo-original.jpg')}
                style={styles.logo}
                contentFit="contain"
              />
            </View>
            <View>
              <Text style={styles.logoName}>RBF Works</Text>
              <Text style={styles.logoTagline}>{t('appTagline')}</Text>
            </View>
          </View>
          <View style={[styles.headerActions, isRTL && styles.rtlRow]}>
            {/* Language toggle */}
            <Pressable
              onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
              hitSlop={8}
            >
              <MaterialIcons name="language" size={22} color={Colors.textOnPrimary} />
            </Pressable>
            {/* Logout */}
            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
              hitSlop={8}
            >
              <MaterialIcons name="logout" size={22} color={Colors.textOnPrimary} />
            </Pressable>
          </View>
        </View>

        {/* User greeting */}
        <View style={[styles.greetRow, isRTL && styles.rtlRow]}>
          <View style={styles.userAvatar}>
            <MaterialIcons name="person" size={20} color={Colors.primary} />
          </View>
          <Text style={styles.greetText}>
            {language === 'ar' ? `مرحباً، ${user?.name}` : `Welcome, ${user?.name}`}
          </Text>
        </View>
      </View>

      {/* Departments */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.sectionRow, isRTL && styles.rtlRow]}>
          <View style={styles.sectionAccent} />
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{t('departments')}</Text>
        </View>

        <View style={styles.grid}>
          {departments.map((dept) => (
            <Pressable
              key={dept.id}
              onPress={() => handleDeptPress(dept)}
              style={({ pressed }) => [
                styles.deptCard,
                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
              ]}
            >
              {/* Top accent */}
              <View style={[styles.deptAccentBar, { backgroundColor: dept.color }]} />

              <View style={styles.deptIconWrap}>
                {dept.icon}
              </View>

              <Text style={[styles.deptName, isRTL && styles.rtlText]}>{getDeptName(dept.id)}</Text>

              {dept.comingSoon ? (
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>{t('comingSoon')}</Text>
                </View>
              ) : (
                <View style={styles.activeBadge}>
                  <MaterialIcons name="chevron-right" size={16} color={Colors.accent} />
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    ...Shadow.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  rtlRow: { flexDirection: 'row-reverse' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  logo: { width: 36, height: 36 },
  logoName: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, color: Colors.textOnPrimary },
  logoTagline: { fontSize: FontSize.xs, color: Colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
  headerActions: { flexDirection: 'row', gap: Spacing.xs },
  iconBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
  },
  greetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetText: { fontSize: FontSize.body, color: Colors.textOnPrimary, fontWeight: FontWeight.medium },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  sectionAccent: { width: 4, height: 22, backgroundColor: Colors.accent, borderRadius: 2 },
  sectionTitle: { fontSize: FontSize.title, fontWeight: FontWeight.bold, color: Colors.primary },
  rtlText: { textAlign: 'right' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  deptCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadow.sm,
    paddingBottom: Spacing.md,
  },
  deptAccentBar: { height: 5, marginBottom: Spacing.md },
  deptIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 'auto',
    marginBottom: Spacing.sm,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deptName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
    lineHeight: 18,
  },
  comingSoonBadge: {
    alignSelf: 'center',
    marginTop: Spacing.sm,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  comingSoonText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: FontWeight.medium },
  activeBadge: {
    alignSelf: 'center',
    marginTop: Spacing.sm,
    backgroundColor: 'rgba(26,173,160,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(26,173,160,0.35)',
  },
});
