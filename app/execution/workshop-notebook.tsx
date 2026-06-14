import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  Platform,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
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

  // Camera
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

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
  const [purchasedMaterials, setPurchasedMaterials] = useState('');
  const [problemsDelays, setProblemsDelays] = useState('');
  const [problemPhotos, setProblemPhotos] = useState<string[]>([]);
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
        entry = await getNotebookEntryById(editId);
      } else {
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
        setPurchasedMaterials(entry.purchasedMaterials || '');
        setProblemsDelays(entry.problemsDelays || '');
        setProblemPhotos(entry.problemPhotos || []);
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

  // ─── Camera Logic ─────────────────────────────────────────────────────────────

  const handleOpenCamera = async () => {
    if (!cameraPermission) return;
    if (!cameraPermission.granted) {
      if (cameraPermission.canAskAgain) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          showAlert(
            language === 'ar' ? 'إذن الكاميرا مطلوب' : 'Camera Permission Required',
            language === 'ar'
              ? 'يرجى السماح بالوصول إلى الكاميرا في إعدادات الجهاز'
              : 'Please allow camera access in device Settings.',
            [{ text: 'OK', style: 'cancel' }]
          );
          return;
        }
      } else {
        showAlert(
          language === 'ar' ? 'إذن مرفوض' : 'Permission Denied',
          language === 'ar'
            ? 'تم رفض إذن الكاميرا. افتح إعدادات الجهاز.'
            : 'Camera permission denied. Open device Settings.',
          [{ text: 'OK', style: 'cancel' }]
        );
        return;
      }
    }
    setCapturedPreview(null);
    setShowCamera(true);
  };

  const handleTakePicture = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, exif: false });
      if (photo?.uri) setCapturedPreview(photo.uri);
    } catch {
      showAlert(t('error'), language === 'ar' ? 'فشل التقاط الصورة' : 'Failed to capture photo.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleConfirmPhoto = () => {
    if (capturedPreview) setProblemPhotos(prev => [...prev, capturedPreview!]);
    setCapturedPreview(null);
    setShowCamera(false);
  };

  const handleRetakePhoto = () => { setCapturedPreview(null); };
  const handleCloseCamera = () => { setCapturedPreview(null); setShowCamera(false); };

  const handleRemoveProblemPhoto = (idx: number) => {
    setProblemPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  // ─── Base64 helper for PDF ─────────────────────────────────────────────────

  const uriToBase64 = async (uri: string): Promise<string> => {
    try {
      let readableUri = uri;
      if (Platform.OS === 'android' && uri.startsWith('content://')) {
        const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const dest = `${FileSystem.cacheDirectory}nb_img_${Date.now()}.${ext}`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        readableUri = dest;
      }
      const base64 = await FileSystem.readAsStringAsync(readableUri, { encoding: FileSystem.EncodingType.Base64 });
      const ext = readableUri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      return `data:${mime};base64,${base64}`;
    } catch { return uri; }
  };

  // ─── Save ─────────────────────────────────────────────────────────────────────

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
        purchasedMaterials: purchasedMaterials.trim() || undefined,
        problemsDelays: problemsDelays.trim() || undefined,
        problemPhotos: problemPhotos.length > 0 ? problemPhotos : undefined,
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

  // ─── PDF Export ───────────────────────────────────────────────────────────────

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const isAr = language === 'ar';

      // Convert problem photos to base64
      const base64ProblemPhotos = await Promise.all(
        problemPhotos.map(u => uriToBase64(u).catch(() => u))
      );

      const html = generateNotebookHTML({
        dayName,
        dateStr,
        weather,
        projectWorkers,
        activeWorkshops,
        activeMachines,
        purchasedMaterials,
        problemsDelays,
        base64ProblemPhotos,
        dailyTasks,
        projectName,
        reportName,
        isAr,
      });

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'RBF Works – Workshop Notebook',
        });
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
            setPurchasedMaterials('');
            setProblemsDelays('');
            setProblemPhotos([]);
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

        {/* ── Date & Weather Card ─────────────────────────────────────── */}
        <SectionCard isRTL={isRTL}>
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

        {/* ── Daily Workshop Data ─────────────────────────────────────── */}
        <SectionCard title={language === 'ar' ? 'بيانات الورشة اليومية' : 'Daily Workshop Data'} isRTL={isRTL}>

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

        {/* ── Purchased & Received Materials ─────────────────────────── */}
        <SectionCard
          title={
            language === 'ar'
              ? 'المواد التي تم شراؤها واستلامها / Purchased & Received Materials'
              : 'Purchased & Received Materials / المواد التي تم شراؤها واستلامها'
          }
          isRTL={isRTL}
        >
          <AppTextInput
            label=""
            value={purchasedMaterials}
            onChangeText={setPurchasedMaterials}
            placeholder={
              language === 'ar'
                ? 'قائمة المواد المشتراة والكميات والموردين والمواد المستلمة...'
                : 'List purchased materials, quantities, suppliers, and received items...'
            }
            numberOfLines={5}
            isRTL={isRTL}
          />
          <View style={[styles.voiceHint, isRTL && styles.rtlRow]}>
            <MaterialIcons name="mic" size={16} color={Colors.textSecondary} />
            <Text style={[styles.voiceHintText, isRTL && styles.rtlText]}>
              {language === 'ar'
                ? 'استخدم ميكروفون لوحة المفاتيح للإدخال الصوتي'
                : 'Use keyboard microphone for voice-to-text input'}
            </Text>
          </View>
        </SectionCard>

        {/* ── Problems, Delays & Challenges ──────────────────────────── */}
        <SectionCard isRTL={isRTL}>
          {/* Section header row with camera button */}
          <View style={[styles.sectionHeaderRow, isRTL && styles.rtlRow]}>
            <View style={styles.sectionHeaderTextWrap}>
              <Text style={[styles.sectionHeaderTitle, isRTL && styles.rtlText]}>
                {language === 'ar'
                  ? 'المشكلات والتأخيرات والتحديات'
                  : 'Problems, Delays & Challenges'}
              </Text>
              <Text style={[styles.sectionHeaderSub, isRTL && styles.rtlText]}>
                {language === 'ar'
                  ? 'Problems, Delays & Challenges'
                  : 'المشكلات والتأخيرات والتحديات'}
              </Text>
            </View>
            <Pressable
              onPress={handleOpenCamera}
              style={({ pressed }) => [styles.cameraBadgeBtn, pressed && styles.cameraBadgeBtnPressed]}
              hitSlop={8}
            >
              <MaterialIcons name="photo-camera" size={20} color="#fff" />
              {problemPhotos.length > 0 ? (
                <View style={styles.cameraBadgeCount}>
                  <Text style={styles.cameraBadgeCountText}>{problemPhotos.length}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <AppTextInput
            label=""
            value={problemsDelays}
            onChangeText={setProblemsDelays}
            placeholder={
              language === 'ar'
                ? 'وصف مشكلات الموقع والتأخيرات والمشكلات التقنية وقضايا السلامة أو تحديات التنفيذ...'
                : 'Describe site issues, delays, technical problems, safety concerns, or execution challenges...'
            }
            numberOfLines={5}
            isRTL={isRTL}
          />

          {/* Problem photos grid */}
          {problemPhotos.length > 0 ? (
            <View style={styles.problemPhotosSection}>
              <View style={[styles.problemPhotosHeader, isRTL && styles.rtlRow]}>
                <MaterialIcons name="warning" size={16} color={Colors.warning || '#E65100'} />
                <Text style={[styles.problemPhotosLabel, isRTL && styles.rtlText]}>
                  {language === 'ar'
                    ? `صور توثيق المشكلات (${problemPhotos.length})`
                    : `Problem Documentation Photos (${problemPhotos.length})`}
                </Text>
              </View>
              <View style={styles.photoGrid}>
                {problemPhotos.map((uri, idx) => (
                  <View key={idx} style={styles.photoItem}>
                    <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
                    <Pressable
                      onPress={() => handleRemoveProblemPhoto(idx)}
                      style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
                    >
                      <MaterialIcons name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Add photo button when no photos yet */}
          {problemPhotos.length === 0 ? (
            <Pressable
              onPress={handleOpenCamera}
              style={({ pressed }) => [styles.addPhotoBtn, pressed && { opacity: 0.8 }]}
            >
              <MaterialIcons name="add-a-photo" size={22} color={Colors.primary} />
              <View style={styles.addPhotoBtnTextWrap}>
                <Text style={[styles.addPhotoBtnLabel, isRTL && styles.rtlText]}>
                  {language === 'ar' ? 'التقاط صورة لتوثيق المشكلة' : 'Capture Photo to Document Issue'}
                </Text>
                <Text style={[styles.addPhotoBtnSub, isRTL && styles.rtlText]}>
                  {language === 'ar' ? 'Capture Issue – فتح الكاميرا' : 'توثيق المشكلة – Open Camera'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.primary} style={{ opacity: 0.6 }} />
            </Pressable>
          ) : (
            <Pressable
              onPress={handleOpenCamera}
              style={({ pressed }) => [styles.addMorePhotoBtn, pressed && { opacity: 0.8 }]}
            >
              <MaterialIcons name="add-a-photo" size={18} color={Colors.primary} />
              <Text style={[styles.addMorePhotoBtnLabel, isRTL && styles.rtlText]}>
                {language === 'ar' ? 'إضافة المزيد من الصور' : 'Add More Photos'}
              </Text>
            </Pressable>
          )}

          <View style={[styles.voiceHint, isRTL && styles.rtlRow, { marginTop: Spacing.xs }]}>
            <MaterialIcons name="mic" size={16} color={Colors.textSecondary} />
            <Text style={[styles.voiceHintText, isRTL && styles.rtlText]}>
              {language === 'ar'
                ? 'استخدم ميكروفون لوحة المفاتيح للإدخال الصوتي'
                : 'Use keyboard microphone for voice-to-text input'}
            </Text>
          </View>
        </SectionCard>

        {/* ── Daily Tasks ─────────────────────────────────────────────── */}
        <SectionCard isRTL={isRTL}>
          <AppTextInput
            label={language === 'ar' ? `${t('dailyTasks')} / Daily Tasks` : `${t('dailyTasks')} / المهام اليومية`}
            value={dailyTasks}
            onChangeText={setDailyTasks}
            placeholder={t('dailyTasksHint')}
            numberOfLines={5}
            isRTL={isRTL}
          />
          <View style={[styles.voiceHint, isRTL && styles.rtlRow]}>
            <MaterialIcons name="mic" size={16} color={Colors.textSecondary} />
            <Text style={[styles.voiceHintText, isRTL && styles.rtlText]}>
              {language === 'ar'
                ? 'استخدم ميكروفون لوحة المفاتيح للإدخال الصوتي'
                : 'Use keyboard microphone for voice-to-text input'}
            </Text>
          </View>
        </SectionCard>

        {/* ── Action Buttons ──────────────────────────────────────────── */}
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
              icon={<MaterialIcons name="save" size={18} color={Colors.primary} />}
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

      {/* ── Weather Picker Modal ──────────────────────────────────────────────── */}
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
                {weather === opt.trim() ? <MaterialIcons name="check-circle" size={22} color={Colors.accent} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ── Camera Modal ─────────────────────────────────────────────────────── */}
      <Modal visible={showCamera} animationType="slide" statusBarTranslucent onRequestClose={handleCloseCamera}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.cameraModal}>
          {capturedPreview ? (
            <>
              <Image source={{ uri: capturedPreview }} style={styles.previewFull} contentFit="contain" />
              <View style={[styles.camTopBar, { paddingTop: insets.top + 8 }]}>
                <Text style={styles.camTopLabel}>
                  {language === 'ar' ? 'معاينة صورة المشكلة' : 'Problem Photo Preview'}
                </Text>
              </View>
              <View style={[styles.previewActions, { paddingBottom: insets.bottom + 24 }]}>
                <Pressable
                  onPress={handleRetakePhoto}
                  style={({ pressed }) => [styles.previewActionBtn, styles.retakeBtn, pressed && { opacity: 0.8 }]}
                >
                  <MaterialIcons name="replay" size={22} color="#fff" />
                  <Text style={styles.previewActionText}>{language === 'ar' ? 'إعادة التصوير' : 'Retake'}</Text>
                </Pressable>
                <Pressable
                  onPress={handleConfirmPhoto}
                  style={({ pressed }) => [styles.previewActionBtn, styles.confirmBtn, pressed && { opacity: 0.85 }]}
                >
                  <MaterialIcons name="check" size={22} color="#fff" />
                  <Text style={styles.previewActionText}>{language === 'ar' ? 'استخدام الصورة' : 'Use Photo'}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <CameraView ref={cameraRef} style={styles.cameraView} facing={cameraFacing} />
              <View style={[styles.camTopBar, { paddingTop: insets.top + 8 }]}>
                <Pressable
                  onPress={handleCloseCamera}
                  style={({ pressed }) => [styles.camIconBtn, pressed && { opacity: 0.7 }]}
                  hitSlop={12}
                >
                  <MaterialIcons name="close" size={26} color="#fff" />
                </Pressable>
                <Text style={styles.camTopLabel}>
                  {language === 'ar' ? 'توثيق المشكلة' : 'Document Issue'}
                </Text>
                <Pressable
                  onPress={() => setCameraFacing(f => f === 'back' ? 'front' : 'back')}
                  style={({ pressed }) => [styles.camIconBtn, pressed && { opacity: 0.7 }]}
                  hitSlop={12}
                >
                  <MaterialIcons name="flip-camera-android" size={26} color="#fff" />
                </Pressable>
              </View>
              <View style={[styles.camControls, { paddingBottom: insets.bottom + 32 }]}>
                <Text style={styles.camGuideText}>
                  {language === 'ar'
                    ? 'وجّه الكاميرا نحو المشكلة أو الموقع واضغط زر التصوير'
                    : 'Point the camera at the issue or site and press capture'}
                </Text>
                <View style={styles.shutterRow}>
                  <View style={styles.thumbPlaceholder} />
                  <Pressable
                    onPress={handleTakePicture}
                    disabled={isCapturing}
                    style={({ pressed }) => [
                      styles.shutterBtn,
                      pressed && { transform: [{ scale: 0.93 }] },
                      isCapturing && { opacity: 0.6 },
                    ]}
                  >
                    {isCapturing
                      ? <ActivityIndicator color={Colors.primary} size="small" />
                      : <View style={styles.shutterInner} />}
                  </Pressable>
                  <Pressable
                    onPress={() => setCameraFacing(f => f === 'back' ? 'front' : 'back')}
                    style={({ pressed }) => [styles.camFlipSmall, pressed && { opacity: 0.7 }]}
                    hitSlop={8}
                  >
                    <MaterialIcons name="flip-camera-android" size={28} color="#fff" />
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ─── PDF Generation ───────────────────────────────────────────────────────────

function generateNotebookHTML(data: {
  dayName: string;
  dateStr: string;
  weather: string;
  projectWorkers: string;
  activeWorkshops: string;
  activeMachines: string;
  purchasedMaterials: string;
  problemsDelays: string;
  base64ProblemPhotos: string[];
  dailyTasks: string;
  projectName: string;
  reportName: string;
  isAr: boolean;
}) {
  const dir = data.isAr ? 'rtl' : 'ltr';
  const year = new Date().getFullYear();

  const problemPhotosHTML = data.base64ProblemPhotos.length > 0
    ? `<div class="photos-grid">
        ${data.base64ProblemPhotos.map((src, i) => `
        <div class="photo-card">
          <img src="${src}" class="photo-img" onerror="this.style.display='none'" />
          <div class="photo-label">${data.isAr ? 'صورة مشكلة' : 'Issue Photo'} ${i + 1}</div>
        </div>`).join('')}
      </div>`
    : `<div class="empty-box">${data.isAr ? 'لا توجد صور موثقة' : 'No documentation photos'}</div>`;

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${data.isAr ? 'ar' : 'en'}">
<head>
<meta charset="UTF-8">
<title>RBF Works – Workshop Notebook</title>
<style>
  @page { margin: 20mm 18mm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, 'Helvetica Neue', sans-serif;
    color: #1B2A4A; direction: ${dir}; background: #fff;
    font-size: 13px; line-height: 1.55;
  }
  .header {
    display: flex; align-items: center; gap: 16px;
    border-bottom: 3px solid #1AADA0; padding-bottom: 16px; margin-bottom: 24px;
  }
  .header-text .company { font-size: 22px; font-weight: 900; color: #1AADA0; }
  .header-text .doc-title { font-size: 14px; color: #5A6784; margin-top: 2px; }
  .meta-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 16px; margin-bottom: 24px; background: #F4F8FF;
    padding: 16px; border-radius: 10px; border: 1px solid #D0D8E8;
  }
  .meta-item label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    color: #8A97B0; letter-spacing: 0.8px;
  }
  .meta-item p { font-size: 15px; font-weight: 700; color: #1B2A4A; margin-top: 4px; }
  .section { margin-bottom: 22px; page-break-inside: avoid; }
  .section-title {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; font-weight: 800; color: #1AADA0;
    text-transform: uppercase; letter-spacing: 1px;
    border-bottom: 1.5px solid #D4EDED; padding-bottom: 7px; margin-bottom: 12px;
  }
  .section-accent { width: 4px; height: 16px; background: #C9A84C; border-radius: 2px; flex-shrink: 0; }
  .section-title.warning-title { color: #D84315; }
  .section-title.warning-title .section-accent { background: #FF6D00; }
  .content-box {
    background: #F8FAFF; border: 1px solid #D0D8E8; border-radius: 8px;
    padding: 14px; min-height: 60px; white-space: pre-wrap;
    font-size: 13px; line-height: 1.75; color: #2A3A5A;
  }
  .warning-box {
    background: #FFF8F5; border: 1px solid #FFCCBC; border-radius: 8px;
    padding: 14px; min-height: 60px; white-space: pre-wrap;
    font-size: 13px; line-height: 1.75; color: #4E342E;
  }
  .empty-box {
    background: #F4F6FA; border: 1px dashed #C0CCE0; border-radius: 8px;
    padding: 18px; text-align: center; color: #8A97B0; font-size: 12px;
  }
  .photos-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 12px; }
  .photo-card {
    background: #FFF8F5; border: 1px solid #FFCCBC;
    border-radius: 8px; overflow: hidden; page-break-inside: avoid;
  }
  .photo-img { width: 100%; height: 130px; object-fit: cover; display: block; }
  .photo-label { text-align: center; font-size: 10px; color: #7B4F3A; padding: 6px; font-weight: 600; }
  .sig-section { margin-top: 32px; page-break-inside: avoid; }
  .sig-row {
    display: flex; gap: 20px; border: 1.5px solid #D0D8E8;
    border-radius: 12px; padding: 20px; background: #F8FAFF;
  }
  .sig-block { flex: 1; display: flex; flex-direction: column; gap: 10px; padding: 0 12px; border-${data.isAr ? 'left' : 'right'}: 1px solid #D4EDED; }
  .sig-block:last-child { border: none; }
  .stamp-block { width: 140px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; align-items: center; padding: 0 12px; border-${data.isAr ? 'left' : 'right'}: 1px solid #D4EDED; }
  .sig-block-title { font-size: 11px; font-weight: 800; color: #1AADA0; text-transform: uppercase; letter-spacing: 0.8px; text-align: center; }
  .sig-block-title-sub { font-size: 10px; color: #8A97B0; text-align: center; margin-top: -6px; }
  .sig-line-area { height: 56px; border-bottom: 1.5px solid #1B2A4A; margin: 4px 8px 0; }
  .sig-fields { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
  .sig-field-row { display: flex; align-items: center; gap: 8px; }
  .sig-field-label { font-size: 11px; font-weight: 700; color: #5A6784; white-space: nowrap; min-width: 38px; }
  .sig-field-line { flex: 1; border-bottom: 1px solid #B2C4D0; height: 16px; }
  .stamp-box-area { flex: 1; width: 110px; border: 1.5px dashed #B2DDD9; border-radius: 8px; background: #fff; min-height: 80px; }
  .footer { border-top: 1.5px solid #1AADA0; padding-top: 10px; margin-top: 32px; display: flex; justify-content: space-between; font-size: 10px; color: #8A97B0; }
</style>
</head>
<body>

<div class="header">
  <div class="header-text">
    <div class="company">RBF Works Engineering</div>
    <div class="doc-title">${data.isAr ? 'دفتر الورشة اليومي / Daily Workshop Notebook' : 'Daily Workshop Notebook / دفتر الورشة اليومي'}</div>
  </div>
</div>

<div class="meta-grid">
  <div class="meta-item"><label>${data.isAr ? 'اليوم' : 'Day'}</label><p>${data.dayName}</p></div>
  <div class="meta-item"><label>${data.isAr ? 'التاريخ' : 'Date'}</label><p>${data.dateStr}</p></div>
  <div class="meta-item"><label>${data.isAr ? 'الطقس' : 'Weather'}</label><p>${data.weather || '-'}</p></div>
  ${data.projectName ? `<div class="meta-item"><label>${data.isAr ? 'المشروع' : 'Project'}</label><p>${data.projectName}</p></div>` : ''}
  ${data.reportName ? `<div class="meta-item"><label>${data.isAr ? 'اسم التقرير' : 'Report Name'}</label><p>${data.reportName}</p></div>` : ''}
</div>

<div class="section">
  <div class="section-title"><div class="section-accent"></div>${data.isAr ? 'عمال المشروع / Project Workers' : 'Project Workers / عمال المشروع'}</div>
  <div class="content-box">${data.projectWorkers || '-'}</div>
</div>

<div class="section">
  <div class="section-title"><div class="section-accent"></div>${data.isAr ? 'الورش النشطة / Active Workshops' : 'Active Workshops / الورش النشطة'}</div>
  <div class="content-box">${data.activeWorkshops || '-'}</div>
</div>

<div class="section">
  <div class="section-title"><div class="section-accent"></div>${data.isAr ? 'الآلات النشطة / Active Machines' : 'Active Machines / الآلات النشطة'}</div>
  <div class="content-box">${data.activeMachines || '-'}</div>
</div>

<div class="section">
  <div class="section-title"><div class="section-accent"></div>${data.isAr ? 'المواد التي تم شراؤها واستلامها / Purchased & Received Materials' : 'Purchased & Received Materials / المواد التي تم شراؤها واستلامها'}</div>
  <div class="content-box">${data.purchasedMaterials || '-'}</div>
</div>

<div class="section">
  <div class="section-title warning-title"><div class="section-accent"></div>${data.isAr ? 'المشكلات والتأخيرات والتحديات / Problems, Delays & Challenges' : 'Problems, Delays & Challenges / المشكلات والتأخيرات والتحديات'}</div>
  <div class="warning-box">${data.problemsDelays || '-'}</div>
  ${data.base64ProblemPhotos.length > 0 ? `
  <div style="margin-top:12px">
    <div style="font-size:11px;font-weight:700;color:#D84315;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.8px;">
      ${data.isAr ? `صور توثيق المشكلات (${data.base64ProblemPhotos.length})` : `Issue Documentation Photos (${data.base64ProblemPhotos.length})`}
    </div>
    ${problemPhotosHTML}
  </div>` : ''}
</div>

<div class="section">
  <div class="section-title"><div class="section-accent"></div>${data.isAr ? 'المهام اليومية المنجزة / Daily Completed Tasks' : 'Daily Completed Tasks / المهام اليومية المنجزة'}</div>
  <div class="content-box">${data.dailyTasks || '-'}</div>
</div>

<div class="sig-section">
  <div class="section-title"><div class="section-accent"></div>${data.isAr ? 'التوقيع والاعتماد / Signature & Approval' : 'Signature & Approval / التوقيع والاعتماد'}</div>
  <div class="sig-row">
    <div class="sig-block">
      <div class="sig-block-title">${data.isAr ? 'توقيع مدير المشروع' : 'Project Manager Signature'}</div>
      <div class="sig-block-title-sub">${data.isAr ? 'Project Manager Signature' : 'توقيع مدير المشروع'}</div>
      <div class="sig-line-area"></div>
      <div class="sig-fields">
        <div class="sig-field-row"><span class="sig-field-label">${data.isAr ? 'الاسم' : 'Name'}:</span><span class="sig-field-line"></span></div>
        <div class="sig-field-row"><span class="sig-field-label">${data.isAr ? 'التاريخ' : 'Date'}:</span><span class="sig-field-line"></span></div>
      </div>
    </div>
    <div class="stamp-block">
      <div class="sig-block-title">${data.isAr ? 'ختم الشركة' : 'Company Stamp'}</div>
      <div class="sig-block-title-sub">${data.isAr ? 'Company Stamp' : 'ختم الشركة'}</div>
      <div class="stamp-box-area"></div>
    </div>
    <div class="sig-block">
      <div class="sig-block-title">${data.isAr ? 'توقيع المراجع' : 'Reviewed By'}</div>
      <div class="sig-block-title-sub">${data.isAr ? 'Reviewed By' : 'توقيع المراجع'}</div>
      <div class="sig-line-area"></div>
      <div class="sig-fields">
        <div class="sig-field-row"><span class="sig-field-label">${data.isAr ? 'الاسم' : 'Name'}:</span><span class="sig-field-line"></span></div>
        <div class="sig-field-row"><span class="sig-field-label">${data.isAr ? 'التاريخ' : 'Date'}:</span><span class="sig-field-line"></span></div>
      </div>
    </div>
  </div>
</div>

<div class="footer">
  <span>RBF Works Engineering © ${year}</span>
  <span>${data.isAr ? 'وثيقة داخلية' : 'Internal Document'}</span>
</div>

</body>
</html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },

  // Edit banner
  editBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.primary + '14', borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.primary + '40',
  },
  editBannerIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary + '22',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  editBannerTextWrap: { flex: 1 },
  editBannerTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.primaryDark },
  editBannerSub: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 2 },

  // Header card
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.inputBg, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 13,
  },
  weatherText: { fontSize: FontSize.bodyLg, color: Colors.text, flex: 1 },

  // Problems section header row
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    gap: 12, marginBottom: Spacing.sm,
  },
  sectionHeaderTextWrap: { flex: 1 },
  sectionHeaderTitle: {
    fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.text, lineHeight: 22,
  },
  sectionHeaderSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },

  // Camera badge button (in section header)
  cameraBadgeBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0, ...Shadow.sm,
  },
  cameraBadgeBtnPressed: { opacity: 0.82, transform: [{ scale: 0.95 }] },
  cameraBadgeCount: {
    position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.error || '#D32F2F', justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 4, borderWidth: 1.5, borderColor: Colors.surface || '#fff',
  },
  cameraBadgeCountText: { fontSize: 10, fontWeight: FontWeight.bold, color: '#fff' },

  // Problem photos section
  problemPhotosSection: { marginTop: Spacing.sm },
  problemPhotosHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm,
  },
  problemPhotosLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoItem: { position: 'relative' },
  photoThumb: { width: 90, height: 90, borderRadius: Radius.sm },
  removeBtn: {
    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center',
  },

  // Add problem photo button
  addPhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.primary + '0D', borderRadius: Radius.md,
    padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary + '30',
    borderStyle: 'dashed',
  },
  addPhotoBtnTextWrap: { flex: 1 },
  addPhotoBtnLabel: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.primaryDark },
  addPhotoBtnSub: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 2 },

  addMorePhotoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm,
    paddingVertical: 10, paddingHorizontal: Spacing.md, marginTop: Spacing.sm,
    borderWidth: 1, borderColor: Colors.cardBorder,
  },
  addMorePhotoBtnLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primary },

  // Voice hint
  voiceHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.surfaceAlt, padding: Spacing.sm,
    borderRadius: Radius.sm, marginTop: Spacing.xs,
  },
  voiceHintText: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1, lineHeight: 16 },

  // Action buttons
  btnGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  halfBtn: { flex: 1 },
  rtlText: { textAlign: 'right' },

  // Weather modal
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl, padding: Spacing.md, ...Shadow.lg,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.subtitle, fontWeight: FontWeight.bold,
    color: Colors.primary, marginBottom: Spacing.md,
  },
  weatherOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.divider, borderRadius: Radius.sm,
  },
  weatherOptionText: { fontSize: FontSize.bodyLg, color: Colors.text },

  // Camera Modal
  cameraModal: { flex: 1, backgroundColor: '#000' },
  cameraView: { flex: 1 },
  previewFull: { flex: 1, backgroundColor: '#000' },
  camTopBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  camTopLabel: { color: '#fff', fontSize: FontSize.bodyLg, fontWeight: FontWeight.semibold },
  camIconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  camControls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg, alignItems: 'center', gap: Spacing.md,
  },
  camGuideText: { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.sm, textAlign: 'center' },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  thumbPlaceholder: { width: 48, height: 48 },
  shutterBtn: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 3, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  camFlipSmall: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  previewActions: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md, backgroundColor: 'rgba(0,0,0,0.6)',
  },
  previewActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: Radius.md,
  },
  retakeBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  confirmBtn: { backgroundColor: Colors.primary },
  previewActionText: { color: '#fff', fontSize: FontSize.body, fontWeight: FontWeight.semibold },
});
