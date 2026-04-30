import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MaterialIcons as MI } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useApp, useTranslation } from '@/hooks/useApp';
import { ScreenHeader } from '@/components';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';

export default function ExecutionScreen() {
  const { isRTL } = useApp();
  const { t, language } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const tools = [
    {
      id: 'notebook',
      icon: <MaterialCommunityIcons name="notebook-edit" size={36} color={Colors.primary} />,
      titleEn: 'Workshop Notebook',
      titleAr: 'دفتر الورشة',
      subEn: 'Daily log – workers, machines & tasks',
      subAr: 'السجل اليومي – العمال والآلات والمهام',
      route: '/execution/workshop-notebook',
      color: Colors.primary,
    },
    {
      id: 'visit',
      icon: <MaterialCommunityIcons name="clipboard-text-search" size={36} color={Colors.primaryDark} />,
      titleEn: 'Workshop Visit Report',
      titleAr: 'تقرير زيارة الورشة',
      subEn: 'Photos, PDF & DWG files, notes',
      subAr: 'الصور وملفات PDF وDWG والملاحظات',
      route: '/execution/visit-report',
      color: Colors.primaryDark,
    },
  ];

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScreenHeader
        title={language === 'ar' ? t('executionDeptAr') : t('executionTitle')}
        subtitle={language === 'ar' ? 'Execution Department' : 'قسم التنفيذ'}
        isRTL={isRTL}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo Banner */}
        <View style={styles.logoBanner}>
          <Image
            source={require('@/assets/images/rbf-logo-original.jpg')}
            style={styles.logoImg}
            contentFit="contain"
          />
          <View>
            <Text style={[styles.bannerTitle, isRTL && styles.rtlText]}>RBF Works</Text>
            <Text style={[styles.bannerSub, isRTL && styles.rtlText]}>
              {language === 'ar' ? 'قسم التنفيذ' : 'Execution Department'}
            </Text>
          </View>
        </View>

        {/* Section header */}
        <View style={[styles.sectionRow, isRTL && styles.rtlRow]}>
          <View style={styles.sectionAccent} />
          <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>
            {language === 'ar' ? 'أدوات القسم' : 'Department Tools'}
          </Text>
        </View>

        {/* My Files Button */}
        <Pressable
          onPress={() => router.push('/execution/history' as any)}
          style={({ pressed }) => [
            styles.myFilesBtn,
            isRTL && styles.rtlRow,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
        >
          <View style={styles.myFilesIconWrap}>
            <MI name="folder-open" size={26} color="#fff" />
          </View>
          <View style={[styles.myFilesTextWrap, isRTL && { alignItems: 'flex-end' }]}>
            <Text style={[styles.myFilesTitle, isRTL && styles.rtlText]}>
              {language === 'ar' ? 'ملفاتي / My Files' : 'My Files / ملفاتي'}
            </Text>
            <Text style={[styles.myFilesSub, isRTL && styles.rtlText]}>
              {language === 'ar' ? 'التقارير والنسخ الاحتياطي' : 'Reports, Backup & Restore'}
            </Text>
          </View>
          <MI name={isRTL ? 'chevron-left' : 'chevron-right'} size={24} color="rgba(255,255,255,0.8)" />
        </Pressable>

        {/* Tool Cards */}
        {tools.map((tool) => (
          <Pressable
            key={tool.id}
            onPress={() => router.push(tool.route as any)}
            style={({ pressed }) => [
              styles.toolCard,
              pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
            ]}
          >
            <View style={[styles.toolCardInner, isRTL && styles.rtlRow]}>
              <View style={[styles.toolIconWrap, { borderColor: tool.color + '40' }]}>
                {tool.icon}
              </View>
              <View style={[styles.toolInfo, isRTL && styles.rtlInfo]}>
                <Text style={[styles.toolTitle, isRTL && styles.rtlText]}>
                  {language === 'ar' ? tool.titleAr : tool.titleEn}
                </Text>
                {language === 'ar' ? (
                  <Text style={[styles.toolTitleSub, isRTL && styles.rtlText]}>{tool.titleEn}</Text>
                ) : (
                  <Text style={[styles.toolTitleSub, isRTL && styles.rtlText]}>{tool.titleAr}</Text>
                )}
                <Text style={[styles.toolSub, isRTL && styles.rtlText]}>
                  {language === 'ar' ? tool.subAr : tool.subEn}
                </Text>
              </View>
              <MaterialIcons
                name={isRTL ? 'chevron-left' : 'chevron-right'}
                size={28}
                color={Colors.accent}
              />
            </View>
            <View style={[styles.toolFooter, { backgroundColor: tool.color }]} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: Spacing.sm },
  logoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadow.sm,
  },
  logoImg: { width: 56, height: 56, borderRadius: 12 },
  bannerTitle: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, color: Colors.primary },
  bannerSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  rtlRow: { flexDirection: 'row-reverse' },
  sectionAccent: { width: 4, height: 22, backgroundColor: Colors.accent, borderRadius: 2 },
  sectionTitle: { fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, color: Colors.primary },
  rtlText: { textAlign: 'right' },
  toolCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    ...Shadow.md,
    marginBottom: Spacing.sm,
  },
  toolCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  toolIconWrap: {
    width: 68,
    height: 68,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  toolInfo: { flex: 1 },
  rtlInfo: { alignItems: 'flex-end' },
  toolTitle: {
    fontSize: FontSize.bodyLg,
    fontWeight: FontWeight.bold,
    color: Colors.text,
  },
  toolTitleSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  toolSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  toolFooter: { height: 4 },
  myFilesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.md,
  },
  myFilesIconWrap: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myFilesTextWrap: { flex: 1 },
  myFilesTitle: {
    fontSize: FontSize.bodyLg,
    fontWeight: FontWeight.bold,
    color: '#fff',
  },
  myFilesSub: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
});
