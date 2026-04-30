import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useApp, useTranslation } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { ScreenHeader, AppTextInput, SectionCard, AppButton } from '@/components';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import {
  NotebookEntry,
  saveNotebookEntry,
  getTodayNotebookEntry,
  getNotebookEntryById,
  generateId,
} from '@/services/storage';

const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export default function WorkshopNotebookScreen() {
  const { isRTL } = useApp();
  const { t, language } = useTranslation();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ editId?: string }>();
  const editId = params.editId;
  const isEditMode = !!editId;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showWeatherPicker, setShowWeatherPicker] = useState(false);
  const [currentEntryId, setCurrentEntryId] = useState<string>('');
  const [projectName, setProjectName] = useState('');
  const [reportName, setReportName] = useState('');
  const [originalCreatedAt, setOriginalCreatedAt] = useState<string>('');

  // Form state
  const [weather, setWeather] = useState('');
  const [projectWorkers, setProjectWorkers] = useState('');
  const [activeWorkshops, setActiveWorkshops] = useState('');
  const [activeMachines, setActiveMachines] = useState('');
  const [dailyTasks, setDailyTasks] = useState('');

  // Date info
  const now = new Date();
  const dayName = language === 'ar' ? DAYS_AR[now.getDay()] : DAYS_EN[now.getDay()];
  const monthName = language === 'ar' ? MONTHS_AR[now.getMonth()] : MONTHS_EN[now.getMonth()];
  const dateStr = language === 'ar'
    ? `${now.getDate()} ${monthName} ${now.getFullYear()}`
    : `${monthName} ${now.getDate()}, ${now.getFullYear()}`;

  useEffect(() => {
    loadEntry();
  }, [editId]);

  const loadEntry = async () => {
    try {
      let entry: NotebookEntry | null = null;

      if (editId) {
        // Edit mode: load the specific entry by ID
        entry = await getNotebookEntryById(editId);
      } else {
        // New/today mode
        entry = await getTodayNotebookEntry();
      }

      if (entry) {
        setCurrentEntryId(entry.id);
        setWeather(entry.weather || '');
        setProjectName(entry.projectName || '');
        setReportName(entry.reportName || '');
        setProjectWorkers(entry.projectWorkers || '');
        setActiveWorkshops(entry.activeWorkshops || '');
        setActiveMachines(entry.activeMachines || '');
        setDailyTasks(entry.dailyTasks || '');
        setOriginalCreatedAt(entry.createdAt);
      } else {
        setCurrentEntryId(generateId());
        setOriginalCreatedAt(now.toISOString());
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const entry: NotebookEntry = {
        id: currentEntryId,
        date: isEditMode ? currentEntryId.split('_')[0] : now.toISOString().split('T')[0],
        day: dayName,
        weather,
        projectWorkers,
        activeWorkshops,
        activeMachines,
        dailyTasks,
        projectName: projectName.trim() || undefined,
        reportName: reportName.trim() || undefined,
        createdAt: originalCreatedAt || now.toISOString(),
        updatedAt: now.toISOString(),
      };
      await saveNotebookEntry(entry);
      showAlert(
        t('success'),
        isEditMode
          ? (language === 'ar' ? 'تم تحديث التقرير بنجاح' : 'Report updated successfully')
          : t('fileSaved')
      );
    } catch (e) {
      showAlert(t('error'), String(e));
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const isAr = language === 'ar';
      const html = generateNotebookHTML({
        dayName, dateStr, weather, projectWorkers,
        activeWorkshops, activeMachines, dailyTasks, isAr,
      });
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'RBF Works – Workshop Notebook' });
      } else {
        await Print.printAsync({ uri });
      }
    } catch (e) {
      showAlert(t('error'), String(e));
    } finally {
      setIsExporting(false);
    }
  };

  const handleClear = () => {
    showAlert(
      language === 'ar' ? 'مسح البيانات' : 'Clear Data',
      language === 'ar' ? 'هل تريد مسح جميع البيانات؟' : 'Clear all entered data?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('clear'),
          style: 'destructive',
          onPress: () => {
            setWeather('');
            setProjectWorkers('');
            setActiveWorkshops('');
            setActiveMachines('');
            setDailyTasks('');
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScreenHeader
        title={language === 'ar' ? t('notebookTitle') : 'Workshop Notebook'}
        subtitle={
          isEditMode
            ? (language === 'ar' ? '✏️ وضع التعديل' : '✏️ Editing Mode')
            : (language === 'ar' ? 'Workshop Notebook' : t('notebookTitle'))
        }
        isRTL={isRTL}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Editing Mode Banner ─────────────────────────────────────── */}
        {isEditMode ? (
          <View style={[styles.editBanner, isRTL && styles.rtlRow]}>
            <View style={styles.editBannerIcon}>
              <MaterialIcons name="edit" size={18} color={Colors.primary} />
            </View>
            <View style={[styles.editBannerTextWrap, isRTL && { alignItems: 'flex-end' }]}>
              <Text style={[styles.editBannerTitle, isRTL && styles.rtlText]}>
                {language === 'ar' ? t('editingMode') : 'Editing Mode'}
              </Text>
              <Text style={[styles.editBannerSub, isRTL && styles.rtlText]}>
                {language === 'ar' ? t('editingModeSub') : 'Changes will update the existing report'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Date & Weather Card */}
        <SectionCard isRTL={isRTL}>
          {/* Logo */}
          <View style={[styles.logoRow, isRTL && styles.rtlRow]}>
            <Image source={require('@/assets/images/rbf-logo-original.jpg')} style={styles.logo} contentFit="contain" />
            <Text style={[styles.logoLabel, isRTL && styles.rtlText]}>
              RBF Works – {language === 'ar' ? 'دفتر الورشة' : 'Workshop Notebook'}
            </Text>
          </View>

          <View style={[styles.metaGrid, isRTL && styles.rtlRow]}>
            <View style={styles.metaItem}>
              <MaterialIcons name="today" size={20} color={Colors.accent} />
              <View style={[isRTL && styles.rtlInfo]}>
                <Text style={[styles.metaLabel, isRTL && styles.rtlText]}>{t('currentDay')}</Text>
                <Text style={[styles.metaValue, isRTL && styles.rtlText]}>{dayName}</Text>
              </View>
            </View>
            <View style={styles.metaItem}>
              <MaterialIcons name="calendar-today" size={20} color={Colors.accent} />
              <View style={[isRTL && styles.rtlInfo]}>
                <Text style={[styles.metaLabel, isRTL && styles.rtlText]}>{t('currentDate')}</Text>
                <Text style={[styles.metaValue, isRTL && styles.rtlText]}>{dateStr}</Text>
              </View>
            </View>
          </View>

          {/* Weather picker */}
          <View>
            <Text style={[styles.metaLabel, isRTL && styles.rtlText, { marginBottom: 6 }]}>{t('weatherStatus')}</Text>
            <Pressable
              onPress={() => setShowWeatherPicker(true)}
              style={({ pressed }) => [styles.weatherPicker, pressed && { opacity: 0.8 }]}
            >
              <Text style={[styles.weatherText, isRTL && styles.rtlText]}>
                {weather || (language === 'ar' ? 'اختر حالة الطقس...' : 'Select weather...')}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={24} color={Colors.primary} />
            </Pressable>
          </View>
        </SectionCard>

        {/* Form Fields */}
        <SectionCard title={language === 'ar' ? 'بيانات الورشة اليومية' : 'Daily Workshop Data'} isRTL={isRTL}>

          {/* Report Name field (visible in edit mode or optionally always) */}
          <AppTextInput
            label={language === 'ar' ? 'اسم التقرير / Report Name' : 'Report Name / اسم التقرير'}
            value={reportName}
            onChangeText={setReportName}
            placeholder={language === 'ar' ? 'اختياري: اسم مميز للتقرير...' : 'Optional: custom name for this report...'}
            numberOfLines={1}
            isRTL={isRTL}
          />

          <AppTextInput
            label={language === 'ar' ? `${t('projectName')} / Project Name` : `${t('projectName')} / اسم المشروع`}
            value={projectName}
            onChangeText={setProjectName}
            placeholder={language === 'ar' ? 'مثال: مشروع أبوظبي، برج X...' : 'e.g. Abu Dhabi Project, Tower X...'}
            numberOfLines={1}
            isRTL={isRTL}
          />
          <AppTextInput
            label={language === 'ar' ? `${t('projectWorkers')} / Project Workers` : `${t('projectWorkers')} / عمال المشروع`}
            value={projectWorkers}
            onChangeText={setProjectWorkers}
            placeholder={t('projectWorkersHint')}
            numberOfLines={4}
            isRTL={isRTL}
          />
          <AppTextInput
            label={language === 'ar' ? `${t('activeWorkshops')} / Active Workshops` : `${t('activeWorkshops')} / الورش النشطة`}
            value={activeWorkshops}
            onChangeText={setActiveWorkshops}
            placeholder={t('activeWorkshopsHint')}
            numberOfLines={4}
            isRTL={isRTL}
          />
          <AppTextInput
            label={language === 'ar' ? `${t('activeMachines')} / Active Machines` : `${t('activeMachines')} / الآلات النشطة`}
            value={activeMachines}
            onChangeText={setActiveMachines}
            placeholder={t('activeMachinesHint')}
            numberOfLines={4}
            isRTL={isRTL}
          />
          <AppTextInput
            label={language === 'ar' ? `${t('dailyTasks')} / Daily Tasks` : `${t('dailyTasks')} / المهام اليومية`}
            value={dailyTasks}
            onChangeText={setDailyTasks}
            placeholder={t('dailyTasksHint')}
            numberOfLines={5}
            isRTL={isRTL}
          />

          {/* Voice hint */}
          <View style={[styles.voiceHint, isRTL && styles.rtlRow]}>
            <MaterialIcons name="mic" size={16} color={Colors.textSecondary} />
            <Text style={[styles.voiceHintText, isRTL && styles.rtlText]}>
              {language === 'ar'
                ? 'استخدم ميكروفون لوحة المفاتيح للإدخال الصوتي'
                : 'Use keyboard microphone for voice-to-text input'}
            </Text>
          </View>
        </SectionCard>

        {/* Action Buttons */}
        <SectionCard isRTL={isRTL}>
          <View style={styles.btnGrid}>
            <AppButton
              label={language === 'ar' ? `${t('exportPDF')} / Export PDF` : `${t('exportPDF')} / تصدير PDF`}
              onPress={handleExportPDF}
              variant="primary"
              loading={isExporting}
              icon={<MaterialIcons name="picture-as-pdf" size={18} color="#fff" />}
              style={styles.halfBtn}
              fullWidth={false}
            />
            <AppButton
              label={
                isEditMode
                  ? (language === 'ar' ? 'حفظ التعديلات / Save Changes' : 'Save Changes / حفظ التعديلات')
                  : (language === 'ar' ? `${t('saveFile')} / Save` : `${t('saveFile')} / حفظ`)
              }
              onPress={handleSave}
              variant="accent"
              loading={isSaving}
              icon={<MaterialIcons name={isEditMode ? 'save' : 'save'} size={18} color={Colors.primary} />}
              style={styles.halfBtn}
              fullWidth={false}
            />
          </View>
          {!isEditMode ? (
            <AppButton
              label={language === 'ar' ? `${t('clear')} / Clear` : `${t('clear')} / مسح`}
              onPress={handleClear}
              variant="outline"
              icon={<MaterialIcons name="clear" size={18} color={Colors.primary} />}
            />
          ) : null}
        </SectionCard>
      </ScrollView>

      {/* Weather Picker Modal */}
      <Modal
        visible={showWeatherPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWeatherPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowWeatherPicker(false)}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {language === 'ar' ? 'اختر حالة الطقس' : 'Select Weather Status'}
            </Text>
            {(t('weatherOptions') as unknown as string[]).map((opt: string, i: number) => (
              <Pressable
                key={i}
                onPress={() => { setWeather(opt.trim()); setShowWeatherPicker(false); }}
                style={({ pressed }) => [styles.weatherOption, pressed && { backgroundColor: Colors.surfaceAlt }]}
              >
                <Text style={[styles.weatherOptionText, isRTL && styles.rtlText]}>{opt.trim()}</Text>
                {weather === opt.trim() && <MaterialIcons name="check-circle" size={22} color={Colors.accent} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function generateNotebookHTML(data: {
  dayName: string; dateStr: string; weather: string;
  projectWorkers: string; activeWorkshops: string;
  activeMachines: string; dailyTasks: string; isAr: boolean;
}) {
  const dir = data.isAr ? 'rtl' : 'ltr';
  return `<!DOCTYPE html>
<html dir="${dir}" lang="${data.isAr ? 'ar' : 'en'}">
<head>
<meta charset="UTF-8">
<title>RBF Works – Workshop Notebook</title>
<style>
  body { font-family: Arial, sans-serif; margin: 30px; color: #1B2A4A; direction: ${dir}; }
  .header { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #C9A84C; padding-bottom: 16px; margin-bottom: 24px; }
  .company-name { font-size: 24px; font-weight: bold; color: #1B2A4A; }
  .doc-title { font-size: 16px; color: #5A6784; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; background: #F4F6FA; padding: 16px; border-radius: 8px; }
  .meta-item label { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #8A97B0; }
  .meta-item p { font-size: 16px; font-weight: bold; color: #1B2A4A; margin-top: 4px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 14px; font-weight: bold; color: #C9A84C; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #D0D8E8; padding-bottom: 6px; margin-bottom: 10px; }
  .content-box { background: #F8FAFF; border: 1px solid #D0D8E8; border-radius: 6px; padding: 12px; min-height: 60px; white-space: pre-wrap; font-size: 14px; line-height: 1.7; }
  .footer { margin-top: 40px; border-top: 1px solid #D0D8E8; padding-top: 12px; font-size: 11px; color: #8A97B0; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="company-name">RBF Works</div>
    <div class="doc-title">${data.isAr ? 'دفتر الورشة اليومي' : 'Daily Workshop Notebook'}</div>
  </div>
</div>
<div class="meta-grid">
  <div class="meta-item"><label>${data.isAr ? 'اليوم' : 'Day'}</label><p>${data.dayName}</p></div>
  <div class="meta-item"><label>${data.isAr ? 'التاريخ' : 'Date'}</label><p>${data.dateStr}</p></div>
  <div class="meta-item"><label>${data.isAr ? 'الطقس' : 'Weather'}</label><p>${data.weather || '-'}</p></div>
</div>
<div class="section">
  <div class="section-title">${data.isAr ? 'عمال المشروع / Project Workers' : 'Project Workers / عمال المشروع'}</div>
  <div class="content-box">${data.projectWorkers || '-'}</div>
</div>
<div class="section">
  <div class="section-title">${data.isAr ? 'الورش النشطة / Active Workshops' : 'Active Workshops / الورش النشطة'}</div>
  <div class="content-box">${data.activeWorkshops || '-'}</div>
</div>
<div class="section">
  <div class="section-title">${data.isAr ? 'الآلات النشطة / Active Machines' : 'Active Machines / الآلات النشطة'}</div>
  <div class="content-box">${data.activeMachines || '-'}</div>
</div>
<div class="section">
  <div class="section-title">${data.isAr ? 'المهام اليومية المنجزة / Daily Completed Tasks' : 'Daily Completed Tasks / المهام اليومية المنجزة'}</div>
  <div class="content-box">${data.dailyTasks || '-'}</div>
</div>
<div class="footer">RBF Works Engineering © ${new Date().getFullYear()} – ${data.isAr ? 'وثيقة داخلية' : 'Internal Document'}</div>
</body></html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },

  // Edit banner
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.primary + '14',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
  },
  editBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary + '22',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  editBannerTextWrap: { flex: 1 },
  editBannerTitle: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.bold,
    color: Colors.primaryDark,
  },
  editBannerSub: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    marginTop: 2,
  },

  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.md },
  rtlRow: { flexDirection: 'row-reverse' },
  logo: { width: 40, height: 40, borderRadius: 8 },
  logoLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primary, flex: 1 },
  metaGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  metaItem: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  rtlInfo: { alignItems: 'flex-end' },
  metaLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontSize: FontSize.bodyLg, fontWeight: FontWeight.bold, color: Colors.primary, marginTop: 2 },
  weatherPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
  },
  weatherText: { fontSize: FontSize.bodyLg, color: Colors.text, flex: 1 },
  voiceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceAlt,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
  },
  voiceHintText: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1, lineHeight: 16 },
  btnGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  halfBtn: { flex: 1 },
  rtlText: { textAlign: 'right' },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.md,
    ...Shadow.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginBottom: Spacing.md,
  },
  weatherOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    borderRadius: Radius.sm,
  },
  weatherOptionText: { fontSize: FontSize.bodyLg, color: Colors.text },
});
