import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
  Platform,
  Modal,
  StatusBar,
  PanResponder,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';
import { useApp, useTranslation } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { ScreenHeader, AppTextInput, SectionCard, AppButton } from '@/components';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import {
  VisitReportEntry,
  saveVisitReport,
  getTodayVisitReport,
  getVisitReportById,
  generateId,
  generateReportId,
  saveLastReportId,
} from '@/services/storage';

// ─── Tiny QR Code generator (pure JS, offline) ──────────────────────────────
// Uses qrcode library; generates SVG data URL embeddable in HTML
async function generateQRDataUrl(text: string): Promise<string> {
  try {
    // Build a simple QR grid using qrcode
    const QRCode = require('qrcode');
    const svg: string = await QRCode.toString(text, { type: 'svg', margin: 1, width: 120 });
    const encoded = encodeURIComponent(svg);
    return `data:image/svg+xml;charset=utf-8,${encoded}`;
  } catch {
    return '';
  }
}

// ─── SVG Signature Pad paths helper ──────────────────────────────────────────
interface Point { x: number; y: number }

export default function VisitReportScreen() {
  const { isRTL } = useApp();
  const { t, language } = useTranslation();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ editId?: string }>();
  const editId = params.editId;
  const isEditMode = !!editId;

  // Camera state
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  // Signature state
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signature, setSignature] = useState<string>('');  // SVG path data
  const [signerName, setSignerName] = useState('');
  const [signedAt, setSignedAt] = useState('');
  const [sigPaths, setSigPaths] = useState<string[]>([]);
  const sigCurrentPath = useRef<string>('');
  const sigLastPoint = useRef<Point | null>(null);

  // Report state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDwgOpening, setIsDwgOpening] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [currentId, setCurrentId] = useState('');
  const [reportId, setReportId] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [pdfFiles, setPdfFiles] = useState<string[]>([]);
  const [dwgFiles, setDwgFiles] = useState<string[]>([]);
  const [pdfUris, setPdfUris] = useState<string[]>([]);
  const [dwgUris, setDwgUris] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [projectName, setProjectName] = useState('');
  const [reportName, setReportName] = useState('');
  const [originalCreatedAt, setOriginalCreatedAt] = useState('');

  const now = new Date();
  const dateStr = now.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  useEffect(() => { loadReport(); }, [editId]);

  const loadReport = async () => {
    try {
      let entry: VisitReportEntry | null = null;
      if (editId) {
        entry = await getVisitReportById(editId);
      } else {
        entry = await getTodayVisitReport();
      }
      if (entry) {
        setCurrentId(entry.id);
        setReportId(entry.reportId || '');
        setPhotos(entry.photos || []);
        setPdfFiles(entry.pdfFiles || []);
        setDwgFiles(entry.dwgFiles || []);
        setNotes(entry.notes || '');
        setProjectName(entry.projectName || '');
        setReportName(entry.reportName || '');
        setSignature(entry.signature || '');
        setSignerName(entry.signerName || '');
        setSignedAt(entry.signedAt || '');
        setOriginalCreatedAt(entry.createdAt);
      } else {
        const newId = generateId();
        setCurrentId(newId);
        setOriginalCreatedAt(now.toISOString());
        // Pre-generate report ID so it shows in UI before save
        const newReportId = await generateReportId();
        setReportId(newReportId);
        await saveLastReportId(newReportId);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Signature Pad Logic ─────────────────────────────────────────────────────

  const sigPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        sigCurrentPath.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        sigLastPoint.current = { x: locationX, y: locationY };
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const last = sigLastPoint.current;
        if (last) {
          // Smooth curve using quadratic bezier control point
          const cx = (last.x + locationX) / 2;
          const cy = (last.y + locationY) / 2;
          sigCurrentPath.current += ` Q${last.x.toFixed(1)},${last.y.toFixed(1)} ${cx.toFixed(1)},${cy.toFixed(1)}`;
          sigLastPoint.current = { x: locationX, y: locationY };
        }
      },
      onPanResponderRelease: () => {
        if (sigCurrentPath.current) {
          setSigPaths(prev => [...prev, sigCurrentPath.current]);
          sigCurrentPath.current = '';
          sigLastPoint.current = null;
        }
      },
    })
  ).current;

  const buildSignatureSVG = (paths: string[]): string => {
    if (paths.length === 0) return '';
    const pathElements = paths
      .map(d => `<path d="${d}" stroke="#1AADA0" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160">${pathElements}</svg>`;
  };

  const handleConfirmSignature = () => {
    if (sigPaths.length === 0) {
      showAlert(
        language === 'ar' ? 'لا يوجد توقيع' : 'No Signature',
        language === 'ar' ? 'يرجى رسم توقيعك أولاً' : 'Please draw your signature first.'
      );
      return;
    }
    const svg = buildSignatureSVG(sigPaths);
    const b64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    setSignature(b64);
    setSignedAt(new Date().toISOString());
    setShowSignaturePad(false);
    showAlert(t('success'), t('signatureAdded'));
  };

  const handleClearSignaturePad = () => { setSigPaths([]); };
  const handleClearSignature = () => {
    showAlert(
      language === 'ar' ? 'إزالة التوقيع' : 'Remove Signature',
      language === 'ar' ? 'هل تريد إزالة التوقيع الحالي؟' : 'Remove the current signature?',
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: () => { setSignature(''); setSignedAt(''); setSigPaths([]); } },
      ]
    );
  };

  // ─── Camera Logic ────────────────────────────────────────────────────────────

  const handleOpenCamera = async () => {
    if (!cameraPermission) return;
    if (!cameraPermission.granted) {
      if (cameraPermission.canAskAgain) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          showAlert(
            language === 'ar' ? 'إذن الكاميرا مطلوب' : 'Camera Permission Required',
            language === 'ar' ? 'يرجى السماح بالوصول إلى الكاميرا في إعدادات الجهاز' : 'Please allow camera access in device Settings.',
            [{ text: 'OK', style: 'cancel' }]
          );
          return;
        }
      } else {
        showAlert(
          language === 'ar' ? 'إذن مرفوض' : 'Permission Denied',
          language === 'ar' ? 'تم رفض إذن الكاميرا. افتح إعدادات الجهاز.' : 'Camera permission denied. Open device Settings.',
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
    if (capturedPreview) setPhotos(prev => [...prev, capturedPreview!]);
    setCapturedPreview(null);
    setShowCamera(false);
  };

  const handleRetakePhoto = () => { setCapturedPreview(null); };
  const handleCloseCamera = () => { setCapturedPreview(null); setShowCamera(false); };

  // ─── Gallery ─────────────────────────────────────────────────────────────────

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert(language === 'ar' ? 'إذن مطلوب' : 'Permission Required',
          language === 'ar' ? 'يرجى السماح بالوصول إلى المعرض' : 'Media library permission denied.',
          [{ text: 'OK', style: 'cancel' }]);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as any, allowsMultipleSelection: true, quality: 0.85, exif: false,
      });
      if (!result.canceled && result.assets) {
        setPhotos(prev => [...prev, ...result.assets.map(a => a.uri)]);
      }
    } catch (e) {
      showAlert(t('error'), language === 'ar' ? 'فشل فتح المعرض' : 'Failed to open gallery.');
    }
  };

  // ─── PDF / DWG ───────────────────────────────────────────────────────────────

  const handleImportPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf', copyToCacheDirectory: true, multiple: true,
      });
      if (!result.canceled && result.assets) {
        setPdfFiles(prev => [...prev, ...result.assets.map(a => a.name || a.uri)]);
        setPdfUris(prev => [...prev, ...result.assets.map(a => a.uri)]);
        showAlert(t('success'), language === 'ar' ? `تم استيراد ${result.assets.length} ملف` : `${result.assets.length} file(s) imported`);
      }
    } catch (e) { showAlert(t('error'), String(e)); }
  };

  const DWG_PACKAGES = ['com.gstarcad.android.dwgfastview', 'com.gstarcad.dwgfastview'];
  const DWG_PLAY = 'https://play.google.com/store/apps/details?id=com.gstarcad.android.dwgfastview';
  const DWG_APPSTORE = 'https://apps.apple.com/app/dwg-fastview/id775920084';

  const buildIntentUri = (fileUri: string, pkg: string): string =>
    `intent:#Intent;action=android.intent.action.VIEW;data=${encodeURIComponent(fileUri)};type=image/vnd.dwg;package=${pkg};end`;

  const openFileInDWGAndroid = async (fileUri: string, fileName: string): Promise<boolean> => {
    for (const pkg of DWG_PACKAGES) {
      try {
        await Linking.openURL(buildIntentUri(fileUri, pkg));
        setDwgFiles(prev => prev.includes(fileName) ? prev : [...prev, fileName]);
        return true;
      } catch { /* try next */ }
    }
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'image/vnd.dwg', dialogTitle: language === 'ar' ? 'فتح باستخدام...' : 'Open with...' });
        setDwgFiles(prev => prev.includes(fileName) ? prev : [...prev, fileName]);
        return true;
      }
    } catch { /* exhausted */ }
    return false;
  };

  const openFileInDWG = async (fileUri: string, fileName: string) => {
    if (!fileUri) return;
    if (Platform.OS === 'android') {
      const opened = await openFileInDWGAndroid(fileUri, fileName);
      if (!opened) {
        showAlert(language === 'ar' ? 'التطبيق غير مثبت' : 'DWG FastView Not Installed',
          language === 'ar' ? 'هل تريد تنزيله من Play Store؟' : 'Download from Play Store?',
          [{ text: t('cancel'), style: 'cancel' }, { text: 'Play Store', onPress: () => Linking.openURL(DWG_PLAY) }]);
      }
      return;
    }
    try {
      if (!await Sharing.isAvailableAsync()) { showAlert(t('error'), 'Sharing unavailable'); return; }
      await Sharing.shareAsync(fileUri, { mimeType: 'image/vnd.dwg', dialogTitle: 'DWG FastView', UTI: 'com.autodesk.dwg' });
      setDwgFiles(prev => prev.includes(fileName) ? prev : [...prev, fileName]);
    } catch {
      showAlert(language === 'ar' ? 'التطبيق غير مثبت' : 'DWG FastView Not Installed',
        language === 'ar' ? 'هل تريد تنزيله من App Store؟' : 'Download from App Store?',
        [{ text: t('cancel'), style: 'cancel' }, { text: 'App Store', onPress: () => Linking.openURL(DWG_APPSTORE) }]);
    }
  };

  const handlePickAndOpenDWG = async () => {
    setIsDwgOpening(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      const ext = (file.name || '').split('.').pop()?.toLowerCase() ?? '';
      if (ext !== 'dwg') {
        showAlert(language === 'ar' ? 'نوع الملف غير صحيح' : 'Invalid File Type',
          language === 'ar' ? 'يرجى اختيار ملف .dwg فقط' : 'Please select a .dwg file only.');
        return;
      }
      setDwgUris(prev => prev.includes(file.uri) ? prev : [...prev, file.uri]);
      await openFileInDWG(file.uri, file.name || '');
    } catch (e) { showAlert(t('error'), String(e)); }
    finally { setIsDwgOpening(false); }
  };

  // ─── Remove helpers ──────────────────────────────────────────────────────────

  const handleRemovePhoto = (idx: number) => { setPhotos(prev => prev.filter((_, i) => i !== idx)); };
  const handleRemovePDF = (idx: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== idx));
    setPdfUris(prev => prev.filter((_, i) => i !== idx));
  };

  // ─── Share Files ─────────────────────────────────────────────────────────────

  const copyToCache = async (uri: string, fileName: string): Promise<string> => {
    const dest = `${FileSystem.cacheDirectory}share_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    if (uri.startsWith('content://') || uri.startsWith('file://')) {
      await FileSystem.copyAsync({ from: uri, to: dest });
      return dest;
    }
    return uri;
  };

  const handleShareFiles = async () => {
    if (pdfFiles.length + dwgFiles.length === 0) {
      showAlert(language === 'ar' ? 'لا توجد ملفات' : 'No Files Available',
        language === 'ar' ? 'لا توجد ملفات PDF أو DWG لمشاركتها' : 'No PDF or DWG files to share.');
      return;
    }
    if (!await Sharing.isAvailableAsync()) {
      showAlert(t('error'), language === 'ar' ? 'المشاركة غير متاحة' : 'Sharing not available.');
      return;
    }
    setIsSharing(true);
    try {
      const allEntries = [
        ...pdfUris.map((uri, i) => ({ name: pdfFiles[i] || `file_${i}.pdf`, uri })),
        ...dwgUris.map((uri, i) => ({ name: dwgFiles[i] || `file_${i}.dwg`, uri })),
      ].filter(e => !!e.uri);

      if (allEntries.length === 0) {
        showAlert(language === 'ar' ? 'الملفات غير متاحة' : 'Files Unavailable',
          language === 'ar' ? 'أعد تحديد الملفات ثم شاركها' : 'Re-select files then share.');
        return;
      }
      if (allEntries.length === 1) {
        const { name, uri } = allEntries[0];
        const localUri = await copyToCache(uri, name);
        await Sharing.shareAsync(localUri, {
          mimeType: name.toLowerCase().endsWith('.dwg') ? 'image/vnd.dwg' : 'application/pdf',
          dialogTitle: language === 'ar' ? 'مشاركة الملف' : 'Share File',
        });
      } else {
        const zip = new JSZip();
        for (const { name, uri } of allEntries) {
          try {
            const localUri = await copyToCache(uri, name);
            const b64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
            zip.file(name, b64, { base64: true });
          } catch { /* skip */ }
        }
        const zipB64 = await zip.generateAsync({ type: 'base64' });
        const zipPath = `${FileSystem.cacheDirectory}RBF_Files_${Date.now()}.zip`;
        await FileSystem.writeAsStringAsync(zipPath, zipB64, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(zipPath, { mimeType: 'application/zip', dialogTitle: language === 'ar' ? 'مشاركة الملفات' : 'Share Files' });
      }
    } catch (e) { showAlert(t('error'), String(e)); }
    finally { setIsSharing(false); }
  };

  // ─── Base64 Conversion ────────────────────────────────────────────────────────

  const uriToBase64 = async (uri: string): Promise<string> => {
    try {
      let readableUri = uri;
      if (Platform.OS === 'android' && uri.startsWith('content://')) {
        const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const dest = `${FileSystem.cacheDirectory}img_${Date.now()}.${ext}`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        readableUri = dest;
      }
      const base64 = await FileSystem.readAsStringAsync(readableUri, { encoding: FileSystem.EncodingType.Base64 });
      const ext = readableUri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      return `data:${mime};base64,${base64}`;
    } catch { return uri; }
  };

  const logoToBase64 = async (): Promise<string> => {
    try {
      const asset = require('@/assets/images/rbf-logo-original.jpg');
      // In Expo, require() for local assets returns an object with uri
      const b64 = await FileSystem.readAsStringAsync(
        (FileSystem.bundleDirectory || '') + 'assets/images/rbf-logo-original.jpg',
        { encoding: FileSystem.EncodingType.Base64 }
      ).catch(async () => {
        // Fallback: try asset uri resolution
        const info = Image.resolveAssetSource ? Image.resolveAssetSource(asset) : null;
        if (info?.uri) {
          return await FileSystem.readAsStringAsync(info.uri, { encoding: FileSystem.EncodingType.Base64 });
        }
        return '';
      });
      return b64 ? `data:image/jpeg;base64,${b64}` : '';
    } catch { return ''; }
  };

  // ─── Save / Export ────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const entry: VisitReportEntry = {
        id: currentId,
        date: isEditMode ? currentId.split('_')[0] : now.toISOString().split('T')[0],
        reportId: reportId || undefined,
        photos,
        pdfFiles,
        dwgFiles,
        notes,
        projectName: projectName.trim() || undefined,
        reportName: reportName.trim() || undefined,
        signature: signature || undefined,
        signerName: signerName.trim() || undefined,
        signedAt: signedAt || undefined,
        createdAt: originalCreatedAt || now.toISOString(),
        updatedAt: now.toISOString(),
      };
      await saveVisitReport(entry);
      showAlert(t('success'), isEditMode
        ? (language === 'ar' ? 'تم تحديث التقرير بنجاح' : 'Report updated successfully')
        : t('fileSaved'));
    } catch (e) { showAlert(t('error'), String(e)); }
    finally { setIsSaving(false); }
  };

  // ─── Enterprise PDF Export ────────────────────────────────────────────────────

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const isAr = language === 'ar';
      const dir = isAr ? 'rtl' : 'ltr';
      const rId = reportId || 'RBF-ENG-' + now.getFullYear() + '-0000';
      const fullDate = now.toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      // 1. Convert all photos to base64
      const base64Photos = await Promise.all(photos.map(u => uriToBase64(u).catch(() => u)));

      // 2. Generate QR code (encodes report ID + date + project)
      const qrText = `RBF Works\nReport: ${rId}\nDate: ${now.toISOString().split('T')[0]}\nProject: ${projectName || 'General'}`;
      const qrDataUrl = await generateQRDataUrl(qrText);

      // 3. Logo base64
      const logob64 = await logoToBase64();

      // ── HTML Sections ────────────────────────────────────────────────────────

      // Cover page
      const coverPage = `
<div class="cover-page">
  <div class="cover-top-bar"></div>
  <div class="cover-body">
    <div class="cover-logo-wrap">
      ${logob64 ? `<img src="${logob64}" class="cover-logo" />` : `<div class="cover-logo-placeholder">RBF</div>`}
    </div>
    <div class="cover-company">RBF Works Engineering</div>
    <div class="cover-divider"></div>
    <div class="cover-title">${isAr ? 'تقرير زيارة الورشة' : 'Workshop Visit Report'}</div>
    <div class="cover-subtitle">${isAr ? 'Workshop Visit Report' : 'تقرير زيارة الورشة'}</div>
    <div class="cover-meta-box">
      <div class="cover-meta-row">
        <span class="cover-meta-label">${isAr ? 'رقم التقرير' : 'Report ID'}</span>
        <span class="cover-meta-value report-id-pill">${rId}</span>
      </div>
      <div class="cover-meta-row">
        <span class="cover-meta-label">${isAr ? 'التاريخ' : 'Date'}</span>
        <span class="cover-meta-value">${fullDate}</span>
      </div>
      ${projectName ? `<div class="cover-meta-row">
        <span class="cover-meta-label">${isAr ? 'اسم المشروع' : 'Project'}</span>
        <span class="cover-meta-value">${projectName}</span>
      </div>` : ''}
      ${reportName ? `<div class="cover-meta-row">
        <span class="cover-meta-label">${isAr ? 'اسم التقرير' : 'Report Name'}</span>
        <span class="cover-meta-value">${reportName}</span>
      </div>` : ''}
      <div class="cover-meta-row">
        <span class="cover-meta-label">${isAr ? 'الصور' : 'Photos'}</span>
        <span class="cover-meta-value">${photos.length}</span>
      </div>
      <div class="cover-meta-row">
        <span class="cover-meta-label">${isAr ? 'الملفات' : 'Files'}</span>
        <span class="cover-meta-value">${pdfFiles.length + dwgFiles.length}</span>
      </div>
    </div>
    ${qrDataUrl ? `
    <div class="cover-qr-section">
      <img src="${qrDataUrl}" class="cover-qr" />
      <div class="cover-qr-label">${isAr ? 'مسح للتحقق من التقرير' : 'Scan to verify report'}</div>
    </div>` : ''}
  </div>
  <div class="cover-bottom-bar">
    <span>${isAr ? 'وثيقة هندسية رسمية – للاستخدام الداخلي' : 'Official Engineering Document – Internal Use'}</span>
    <span>RBF Works Engineering © ${now.getFullYear()}</span>
  </div>
</div>
<div class="page-break"></div>`;

      // Page header (all pages after cover)
      const pageHeader = `
<div class="page-header">
  ${logob64 ? `<img src="${logob64}" class="header-logo" />` : '<span class="header-company">RBF Works</span>'}
  <div class="header-center">
    <span class="header-company">RBF Works Engineering</span>
    <span class="header-doc">${isAr ? 'تقرير زيارة الورشة' : 'Workshop Visit Report'}</span>
  </div>
  <div class="header-id-box">
    <span class="header-id-label">${isAr ? 'رقم التقرير' : 'Report ID'}</span>
    <span class="header-id-value">${rId}</span>
  </div>
</div>`;

      // Photos section
      const photosSection = base64Photos.length > 0
        ? `<div class="section">
          <div class="section-title">
            <div class="section-accent"></div>
            <span>${isAr ? 'الصور المرفقة' : 'Attached Photos'} / ${isAr ? 'Attached Photos' : 'الصور المرفقة'}</span>
          </div>
          <div class="photos-grid">
            ${base64Photos.map((src, i) => `
            <div class="photo-card">
              <img src="${src}" class="photo-img" onerror="this.style.display='none'" />
              <div class="photo-label">${isAr ? 'صورة' : 'Photo'} ${i + 1}</div>
            </div>`).join('')}
          </div>
        </div>`
        : `<div class="section">
          <div class="section-title"><div class="section-accent"></div><span>${isAr ? 'الصور المرفقة' : 'Attached Photos'}</span></div>
          <div class="empty-box">${isAr ? 'لا توجد صور مرفقة' : 'No photos attached'}</div>
        </div>`;

      // Files section
      const allFiles = [
        ...pdfFiles.map(f => ({ name: f, type: 'pdf' })),
        ...dwgFiles.map(f => ({ name: f, type: 'dwg' })),
      ];
      const filesSection = `<div class="section">
        <div class="section-title"><div class="section-accent"></div><span>${isAr ? 'الملفات المرفقة' : 'Attached Files'} / ${isAr ? 'Attached Files' : 'الملفات المرفقة'}</span></div>
        ${allFiles.length > 0
          ? allFiles.map(f => `
          <div class="file-row">
            <span class="file-icon">${f.type === 'pdf' ? '📄' : '📐'}</span>
            <span class="file-name">${f.name}</span>
            <span class="file-type-badge">${f.type.toUpperCase()}</span>
          </div>`).join('')
          : `<div class="empty-box">${isAr ? 'لا توجد ملفات مرفقة' : 'No files attached'}</div>`}
      </div>`;

      // Notes section
      const notesSection = `<div class="section">
        <div class="section-title"><div class="section-accent"></div><span>${isAr ? 'ملاحظات الزيارة' : 'Visit Notes'} / ${isAr ? 'Visit Notes' : 'ملاحظات الزيارة'}</span></div>
        <div class="notes-box">${notes || (isAr ? 'لا توجد ملاحظات' : 'No notes')}</div>
      </div>`;

      // Signature section
      const sigDate = signedAt ? new Date(signedAt).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : fullDate;
      const signatureSection = `<div class="section sig-section">
        <div class="section-title"><div class="section-accent"></div><span>${isAr ? 'التوقيع الإلكتروني' : 'Electronic Signature'} / ${isAr ? 'Project Manager Signature' : 'توقيع مدير المشروع'}</span></div>
        <div class="sig-card">
          <div class="sig-card-inner">
            <div class="sig-label">${isAr ? 'توقيع مدير المشروع' : 'Project Manager Signature'}</div>
            <div class="sig-box">
              ${signature
                ? `<img src="${signature}" class="sig-image" />`
                : `<div class="sig-empty">${isAr ? 'لم يتم التوقيع بعد' : 'Not yet signed'}</div>`}
            </div>
            <div class="sig-meta-row">
              ${signerName ? `<div class="sig-name">${signerName}</div>` : ''}
              <div class="sig-date">${isAr ? 'التاريخ:' : 'Date:'} ${sigDate}</div>
            </div>
          </div>
          <div class="stamp-box">
            <div class="stamp-inner">
              <div class="stamp-text">RBF WORKS</div>
              <div class="stamp-text-ar">أعمال RBF</div>
              <div class="stamp-sub">Engineering</div>
            </div>
          </div>
        </div>
      </div>`;

      // QR section on last page
      const qrSection = qrDataUrl ? `<div class="section qr-verify-section">
        <div class="section-title"><div class="section-accent"></div><span>${isAr ? 'التحقق من التقرير' : 'Report Verification'}</span></div>
        <div class="qr-verify-row">
          <img src="${qrDataUrl}" class="qr-verify-img" />
          <div class="qr-verify-info">
            <div class="qr-verify-id">${rId}</div>
            <div class="qr-verify-label">${isAr ? 'مسح رمز QR للتحقق من صحة هذا التقرير' : 'Scan QR code to verify this report'}</div>
            <div class="qr-verify-date">${isAr ? 'صدر بتاريخ:' : 'Issued:'} ${fullDate}</div>
          </div>
        </div>
      </div>` : '';

      // Footer (all pages)
      const pageFooter = `
<div class="page-footer">
  <span>RBF Works Engineering © ${now.getFullYear()}</span>
  <span>${rId}</span>
  <span>${isAr ? 'وثيقة داخلية' : 'Internal Document'}</span>
</div>`;

      // ── Full HTML ──────────────────────────────────────────────────────────────

      const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${isAr ? 'ar' : 'en'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RBF Works – ${rId}</title>
<style>
  @page { margin: 0; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, 'Helvetica Neue', sans-serif;
    color: #1B2A4A;
    direction: ${dir};
    background: #fff;
    font-size: 13px;
    line-height: 1.55;
  }

  /* ── Cover Page ──────────────────────────────────────────────── */
  .cover-page {
    width: 210mm;
    min-height: 297mm;
    display: flex;
    flex-direction: column;
    background: linear-gradient(160deg, #0d3b38 0%, #1AADA0 60%, #2EC4B6 100%);
    position: relative;
    overflow: hidden;
  }
  .cover-top-bar { height: 6px; background: #C9A84C; }
  .cover-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 40px;
    gap: 20px;
  }
  .cover-logo-wrap {
    width: 110px;
    height: 110px;
    border-radius: 20px;
    background: rgba(255,255,255,0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    overflow: hidden;
  }
  .cover-logo { width: 100px; height: 100px; object-fit: contain; }
  .cover-logo-placeholder {
    font-size: 36px;
    font-weight: 900;
    color: #1AADA0;
    letter-spacing: 2px;
  }
  .cover-company {
    font-size: 28px;
    font-weight: 900;
    color: #fff;
    letter-spacing: 2px;
    text-transform: uppercase;
    text-align: center;
  }
  .cover-divider {
    width: 80px;
    height: 3px;
    background: #C9A84C;
    border-radius: 2px;
  }
  .cover-title {
    font-size: 32px;
    font-weight: 800;
    color: #fff;
    text-align: center;
    line-height: 1.3;
  }
  .cover-subtitle {
    font-size: 16px;
    color: rgba(255,255,255,0.72);
    text-align: center;
    font-weight: 400;
  }
  .cover-meta-box {
    background: rgba(255,255,255,0.12);
    border: 1.5px solid rgba(255,255,255,0.3);
    border-radius: 16px;
    padding: 20px 28px;
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    backdrop-filter: blur(4px);
  }
  .cover-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid rgba(255,255,255,0.15);
    padding-bottom: 8px;
  }
  .cover-meta-row:last-child { border-bottom: none; padding-bottom: 0; }
  .cover-meta-label { font-size: 11px; color: rgba(255,255,255,0.65); text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; }
  .cover-meta-value { font-size: 13px; color: #fff; font-weight: 700; text-align: ${isAr ? 'left' : 'right'}; }
  .report-id-pill {
    background: #C9A84C;
    color: #fff;
    padding: 3px 12px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 1px;
  }
  .cover-qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: rgba(255,255,255,0.92);
    border-radius: 12px;
    padding: 14px 20px;
  }
  .cover-qr { width: 100px; height: 100px; }
  .cover-qr-label { font-size: 11px; color: #1AADA0; font-weight: 600; text-align: center; }
  .cover-bottom-bar {
    background: rgba(0,0,0,0.3);
    padding: 14px 28px;
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: rgba(255,255,255,0.7);
  }

  /* ── Page Break ───────────────────────────────────────────────── */
  .page-break { page-break-after: always; break-after: page; }

  /* ── Page Header ──────────────────────────────────────────────── */
  .page-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 24px;
    border-bottom: 3px solid #1AADA0;
    margin-bottom: 24px;
    background: #f8ffff;
  }
  .header-logo { width: 44px; height: 44px; object-fit: contain; border-radius: 8px; }
  .header-company-text { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #8A97B0; }
  .header-center { flex: 1; display: flex; flex-direction: column; }
  .header-company { font-size: 15px; font-weight: 800; color: #1AADA0; }
  .header-doc { font-size: 11px; color: #5A6784; margin-top: 2px; }
  .header-id-box {
    display: flex;
    flex-direction: column;
    align-items: ${isAr ? 'flex-start' : 'flex-end'};
    background: #1AADA0;
    border-radius: 8px;
    padding: 6px 12px;
    min-width: 120px;
  }
  .header-id-label { font-size: 9px; color: rgba(255,255,255,0.75); text-transform: uppercase; letter-spacing: 0.8px; }
  .header-id-value { font-size: 12px; font-weight: 800; color: #fff; letter-spacing: 1px; }

  /* ── Content Sections ─────────────────────────────────────────── */
  .section { margin: 0 24px 28px; }
  .section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 800;
    color: #1AADA0;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1.5px solid #D4EDED;
    padding-bottom: 8px;
    margin-bottom: 14px;
  }
  .section-accent {
    width: 4px;
    height: 18px;
    background: #C9A84C;
    border-radius: 2px;
    flex-shrink: 0;
  }

  /* ── Photos ───────────────────────────────────────────────────── */
  .photos-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
  }
  .photo-card {
    background: #F8FAFF;
    border: 1px solid #D0D8E8;
    border-radius: 10px;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .photo-img {
    width: 100%;
    height: 140px;
    object-fit: cover;
    display: block;
  }
  .photo-label {
    text-align: center;
    font-size: 10px;
    color: #5A6784;
    padding: 6px;
    font-weight: 600;
  }

  /* ── Files ────────────────────────────────────────────────────── */
  .file-row {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #F8FAFF;
    border: 1px solid #D0D8E8;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 8px;
  }
  .file-icon { font-size: 18px; flex-shrink: 0; }
  .file-name { flex: 1; font-size: 13px; color: #1B2A4A; font-weight: 500; }
  .file-type-badge {
    background: #E8F5E9;
    color: #2E7D32;
    font-size: 10px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 6px;
  }

  /* ── Notes ────────────────────────────────────────────────────── */
  .notes-box {
    background: #F8FAFF;
    border: 1px solid #D0D8E8;
    border-radius: 10px;
    padding: 16px;
    white-space: pre-wrap;
    line-height: 1.8;
    min-height: 80px;
    font-size: 13px;
    color: #2A3A5A;
  }
  .empty-box {
    background: #F4F6FA;
    border: 1px dashed #C0CCE0;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    color: #8A97B0;
    font-size: 12px;
  }

  /* ── Signature ────────────────────────────────────────────────── */
  .sig-section { page-break-inside: avoid; }
  .sig-card {
    display: flex;
    gap: 20px;
    align-items: stretch;
  }
  .sig-card-inner {
    flex: 1;
    background: #F8FAFF;
    border: 1.5px solid #D0D8E8;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .sig-label {
    font-size: 11px;
    font-weight: 700;
    color: #8A97B0;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .sig-box {
    border: 1.5px solid #B2DDD9;
    border-radius: 8px;
    background: #fff;
    min-height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .sig-image { max-width: 100%; max-height: 100px; object-fit: contain; }
  .sig-empty { color: #B2DDD9; font-size: 12px; font-style: italic; }
  .sig-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-top: 1px solid #D4EDED;
    padding-top: 8px;
    margin-top: 4px;
  }
  .sig-name { font-size: 13px; font-weight: 700; color: #1B2A4A; }
  .sig-date { font-size: 11px; color: #5A6784; }
  .stamp-box {
    width: 110px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .stamp-inner {
    width: 100px;
    height: 100px;
    border: 3px solid #1AADA0;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: rgba(26,173,160,0.05);
  }
  .stamp-text {
    font-size: 10px;
    font-weight: 900;
    color: #1AADA0;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .stamp-text-ar { font-size: 9px; font-weight: 700; color: #148A7F; }
  .stamp-sub { font-size: 8px; color: #5A6784; text-transform: uppercase; letter-spacing: 1px; }

  /* ── QR Verify ────────────────────────────────────────────────── */
  .qr-verify-row {
    display: flex;
    gap: 20px;
    align-items: center;
    background: #F8FAFF;
    border: 1px solid #D0D8E8;
    border-radius: 12px;
    padding: 16px 20px;
  }
  .qr-verify-img { width: 90px; height: 90px; flex-shrink: 0; }
  .qr-verify-info { display: flex; flex-direction: column; gap: 6px; }
  .qr-verify-id { font-size: 18px; font-weight: 900; color: #1AADA0; letter-spacing: 2px; }
  .qr-verify-label { font-size: 12px; color: #5A6784; max-width: 280px; line-height: 1.5; }
  .qr-verify-date { font-size: 11px; color: #8A97B0; margin-top: 2px; }

  /* ── Page Footer ──────────────────────────────────────────────── */
  .page-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 24px;
    background: #f8ffff;
    border-top: 2px solid #1AADA0;
    font-size: 9px;
    color: #8A97B0;
  }
</style>
</head>
<body>
${coverPage}
${pageHeader}
${photosSection}
${filesSection}
${notesSection}
${signatureSection}
${qrSection}
${pageFooter}
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `RBF Works – ${rId}`,
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

  // ─── Signature Pad SVG Renderer ───────────────────────────────────────────────

  const SigPathsView = useCallback(() => (
    <View style={styles.sigCanvas} {...sigPanResponder.panHandlers}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 320 160"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {sigPaths.map((d, i) => (
          <path
            key={i}
            d={d}
            stroke={Colors.primary}
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      {sigPaths.length === 0 ? (
        <View style={styles.sigPlaceholder}>
          <MaterialIcons name="gesture" size={32} color={Colors.border} />
          <Text style={styles.sigPlaceholderText}>
            {language === 'ar' ? 'ارسم توقيعك هنا' : 'Draw your signature here'}
          </Text>
        </View>
      ) : null}
    </View>
  ), [sigPaths, language]);

  // ─── Render ───────────────────────────────────────────────────────────────────

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
        title={language === 'ar' ? t('visitReportTitle') : 'Visit Report'}
        subtitle={isEditMode
          ? (language === 'ar' ? '✏️ وضع التعديل' : '✏️ Editing Mode')
          : (language === 'ar' ? 'Workshop Visit Report' : t('visitReportTitle'))}
        isRTL={isRTL}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Edit Banner ────────────────────────────────────────────── */}
        {isEditMode ? (
          <View style={[styles.editBanner, isRTL && styles.rtlRow]}>
            <View style={styles.editBannerIcon}>
              <MaterialIcons name="edit" size={18} color={Colors.primary} />
            </View>
            <View style={[styles.editBannerTextWrap, isRTL && { alignItems: 'flex-end' }]}>
              <Text style={[styles.editBannerTitle, isRTL && styles.rtlText]}>{language === 'ar' ? t('editingMode') : 'Editing Mode'}</Text>
              <Text style={[styles.editBannerSub, isRTL && styles.rtlText]}>{language === 'ar' ? t('editingModeSub') : 'Changes will update the existing report'}</Text>
            </View>
          </View>
        ) : null}

        {/* ── Report ID Badge ────────────────────────────────────────── */}
        <SectionCard isRTL={isRTL}>
          <View style={[styles.logoRow, isRTL && styles.rtlRow]}>
            <Image source={require('@/assets/images/rbf-logo-original.jpg')} style={styles.logo} contentFit="contain" />
            <View style={[{ flex: 1 }, isRTL && styles.rtlInfo]}>
              <Text style={[styles.bannerTitle, isRTL && styles.rtlText]}>
                {language === 'ar' ? 'تقرير زيارة الورشة' : 'Workshop Visit Report'}
              </Text>
              <Text style={[styles.bannerDate, isRTL && styles.rtlText]}>{dateStr}</Text>
            </View>
            {reportId ? (
              <View style={styles.reportIdBadge}>
                <Text style={styles.reportIdBadgeLabel}>{language === 'ar' ? 'رقم التقرير' : 'Report ID'}</Text>
                <Text style={styles.reportIdBadgeValue}>{reportId}</Text>
              </View>
            ) : null}
          </View>
        </SectionCard>

        {/* ── Photos & Files ─────────────────────────────────────────── */}
        <SectionCard
          title={language === 'ar' ? 'الصور والملفات / Photos & Files' : 'Photos & Files / الصور والملفات'}
          isRTL={isRTL}
        >
          <Pressable
            onPress={handleOpenCamera}
            style={({ pressed }) => [styles.cameraBtn, pressed && styles.cameraBtnPressed]}
          >
            <View style={styles.cameraBtnIcon}><MaterialIcons name="photo-camera" size={28} color="#fff" /></View>
            <View style={styles.cameraBtnTextWrap}>
              <Text style={styles.cameraBtnLabel}>{language === 'ar' ? 'التقاط صورة' : 'Take Photo'}</Text>
              <Text style={styles.cameraBtnSub}>{language === 'ar' ? 'Take Photo – فتح الكاميرا' : 'التقاط صورة – Open Camera'}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="rgba(255,255,255,0.7)" />
          </Pressable>

          <View style={styles.actionGrid}>
            <Pressable onPress={handlePickFromGallery} style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
              <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
                <MaterialIcons name="photo-library" size={24} color="#2E7D32" />
              </View>
              <Text style={[styles.actionLabel, isRTL && styles.rtlText]}>{language === 'ar' ? 'المعرض\nGallery' : 'Gallery\nالمعرض'}</Text>
            </Pressable>
            <Pressable onPress={handleImportPDF} style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
              <View style={[styles.actionIcon, { backgroundColor: '#FFF3E0' }]}>
                <MaterialIcons name="picture-as-pdf" size={24} color="#E65100" />
              </View>
              <Text style={[styles.actionLabel, isRTL && styles.rtlText]}>{language === 'ar' ? 'ملف PDF\nPDF File' : 'PDF File\nملف PDF'}</Text>
            </Pressable>
            <Pressable
              onPress={handlePickAndOpenDWG}
              disabled={isDwgOpening}
              style={({ pressed }) => [styles.actionBtn, styles.dwgBtn, pressed && styles.dwgBtnPressed, isDwgOpening && { opacity: 0.7 }]}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                {isDwgOpening
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <MaterialCommunityIcons name="drawing-box" size={24} color="#fff" />}
              </View>
              <Text style={[styles.actionLabel, styles.dwgBtnLabel]}>{`DWG\nFastView`}</Text>
            </Pressable>
          </View>
        </SectionCard>

        {/* ── Photos Grid ────────────────────────────────────────────── */}
        {photos.length > 0 ? (
          <SectionCard title={`${t('photos')} (${photos.length})`} isRTL={isRTL}>
            <View style={styles.photoGrid}>
              {photos.map((uri, idx) => (
                <View key={idx} style={styles.photoItem}>
                  <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
                  <Pressable onPress={() => handleRemovePhoto(idx)} style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}>
                    <MaterialIcons name="close" size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          </SectionCard>
        ) : null}

        {/* ── DWG Files ──────────────────────────────────────────────── */}
        {dwgFiles.length > 0 ? (
          <SectionCard title={language === 'ar' ? `ملفات DWG (${dwgFiles.length})` : `DWG Files (${dwgFiles.length})`} isRTL={isRTL}>
            {dwgFiles.map((file, idx) => (
              <Pressable key={idx} onPress={() => openFileInDWG('', file)}
                style={({ pressed }) => [styles.fileItem, isRTL && styles.rtlRow, pressed && { opacity: 0.75 }]}>
                <MaterialCommunityIcons name="drawing-box" size={22} color={Colors.primaryDark} />
                <Text style={[styles.fileName, isRTL && styles.rtlText]} numberOfLines={1}>{file}</Text>
                <MaterialIcons name="open-in-new" size={16} color={Colors.textMuted} />
              </Pressable>
            ))}
          </SectionCard>
        ) : null}

        {/* ── PDF Files ──────────────────────────────────────────────── */}
        {pdfFiles.length > 0 ? (
          <SectionCard title={`${t('attachedFiles')} (${pdfFiles.length})`} isRTL={isRTL}>
            {pdfFiles.map((file, idx) => (
              <View key={idx} style={[styles.fileItem, isRTL && styles.rtlRow]}>
                <MaterialIcons name="picture-as-pdf" size={22} color={Colors.error} />
                <Text style={[styles.fileName, isRTL && styles.rtlText]} numberOfLines={1}>{file}</Text>
                <Pressable onPress={() => handleRemovePDF(idx)} hitSlop={8} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                  <MaterialIcons name="close" size={18} color={Colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </SectionCard>
        ) : null}

        {/* ── Notes & Info ───────────────────────────────────────────── */}
        <SectionCard isRTL={isRTL}>
          <AppTextInput
            label={language === 'ar' ? 'اسم التقرير / Report Name' : 'Report Name / اسم التقرير'}
            value={reportName} onChangeText={setReportName}
            placeholder={language === 'ar' ? 'اختياري: اسم مميز للتقرير...' : 'Optional: custom name for this report...'}
            numberOfLines={1} isRTL={isRTL}
          />
          <AppTextInput
            label={language === 'ar' ? `${t('projectName')} / Project Name` : `${t('projectName')} / اسم المشروع`}
            value={projectName} onChangeText={setProjectName}
            placeholder={language === 'ar' ? 'مثال: مشروع أبوظبي...' : 'e.g. Abu Dhabi Project...'}
            numberOfLines={1} isRTL={isRTL}
          />
          <AppTextInput
            label={language === 'ar' ? `${t('notes')} / Visit Notes` : `${t('notes')} / ملاحظات الزيارة`}
            value={notes} onChangeText={setNotes}
            placeholder={t('notesHint')} numberOfLines={6} isRTL={isRTL}
          />
          <View style={[styles.voiceHint, isRTL && styles.rtlRow]}>
            <MaterialIcons name="mic" size={16} color={Colors.textSecondary} />
            <Text style={[styles.voiceHintText, isRTL && styles.rtlText]}>
              {language === 'ar' ? 'استخدم ميكروفون لوحة المفاتيح للإدخال الصوتي' : 'Use keyboard microphone for voice-to-text input'}
            </Text>
          </View>
        </SectionCard>

        {/* ── Signature Section ──────────────────────────────────────── */}
        <SectionCard
          title={language === 'ar' ? 'التوقيع الإلكتروني / E-Signature' : 'Electronic Signature / التوقيع'}
          isRTL={isRTL}
        >
          {signature ? (
            /* Has signature → show preview */
            <View style={styles.sigPreviewWrap}>
              <View style={[styles.sigPreviewRow, isRTL && styles.rtlRow]}>
                <View style={styles.sigPreviewImgBox}>
                  <Image source={{ uri: signature }} style={styles.sigPreviewImg} contentFit="contain" />
                </View>
                <View style={[styles.sigPreviewInfo, isRTL && { alignItems: 'flex-end' }]}>
                  <View style={styles.sigDoneBadge}>
                    <MaterialIcons name="verified" size={14} color={Colors.success} />
                    <Text style={styles.sigDoneBadgeText}>{language === 'ar' ? 'تم التوقيع' : 'Signed'}</Text>
                  </View>
                  {signerName ? <Text style={[styles.signerNameText, isRTL && styles.rtlText]}>{signerName}</Text> : null}
                  {signedAt ? (
                    <Text style={[styles.sigDateText, isRTL && styles.rtlText]}>
                      {new Date(signedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={[styles.sigActionRow, isRTL && styles.rtlRow]}>
                <Pressable onPress={() => { setSigPaths([]); setShowSignaturePad(true); }}
                  style={({ pressed }) => [styles.sigActionBtn, styles.sigEditBtn, pressed && { opacity: 0.8 }]}>
                  <MaterialIcons name="edit" size={16} color={Colors.primary} />
                  <Text style={styles.sigEditBtnText}>{language === 'ar' ? 'إعادة التوقيع' : 'Re-sign'}</Text>
                </Pressable>
                <Pressable onPress={handleClearSignature}
                  style={({ pressed }) => [styles.sigActionBtn, styles.sigClearBtn, pressed && { opacity: 0.8 }]}>
                  <MaterialIcons name="delete-outline" size={16} color={Colors.error} />
                  <Text style={styles.sigClearBtnText}>{language === 'ar' ? 'إزالة' : 'Remove'}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* No signature → sign button */
            <Pressable
              onPress={() => { setSigPaths([]); setShowSignaturePad(true); }}
              style={({ pressed }) => [styles.sigInviteBtn, pressed && styles.sigInviteBtnPressed]}
            >
              <View style={styles.sigInviteIcon}>
                <MaterialCommunityIcons name="draw-pen" size={30} color={Colors.primary} />
              </View>
              <View style={[styles.sigInviteTextWrap, isRTL && { alignItems: 'flex-end' }]}>
                <Text style={[styles.sigInviteTitle, isRTL && styles.rtlText]}>
                  {language === 'ar' ? t('signatureTitle') : 'Project Manager Signature'}
                </Text>
                <Text style={[styles.sigInviteSub, isRTL && styles.rtlText]}>
                  {language === 'ar' ? 'اضغط لإضافة التوقيع الإلكتروني' : 'Tap to add electronic signature'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={Colors.primary} />
            </Pressable>
          )}
          {/* Signer name input */}
          <AppTextInput
            label={language === 'ar' ? t('signerNameLabel') : 'Signer Name (optional)'}
            value={signerName} onChangeText={setSignerName}
            placeholder={language === 'ar' ? t('signerNameHint') : 'Enter project manager name...'}
            numberOfLines={1} isRTL={isRTL}
          />
        </SectionCard>

        {/* ── Action Buttons ─────────────────────────────────────────── */}
        <SectionCard isRTL={isRTL}>
          <View style={styles.btnGrid}>
            <AppButton
              label={language === 'ar' ? `${t('exportPDF')} / PDF` : `${t('exportPDF')} / تصدير`}
              onPress={handleExportPDF} variant="primary" loading={isExporting}
              icon={<MaterialIcons name="picture-as-pdf" size={18} color="#fff" />}
              style={styles.halfBtn} fullWidth={false}
            />
            <AppButton
              label={isEditMode
                ? (language === 'ar' ? 'حفظ التعديلات' : 'Save Changes')
                : (language === 'ar' ? `${t('saveFile')}` : `${t('saveFile')}`)}
              onPress={handleSave} variant="accent" loading={isSaving}
              icon={<MaterialIcons name="save" size={18} color={Colors.primary} />}
              style={styles.halfBtn} fullWidth={false}
            />
          </View>
          <Pressable onPress={handleShareFiles} disabled={isSharing}
            style={({ pressed }) => [styles.shareFilesBtn, pressed && styles.shareFilesBtnPressed, isSharing && { opacity: 0.65 }]}>
            {isSharing ? <ActivityIndicator color="#fff" size="small" /> : <MaterialIcons name="share" size={20} color="#fff" />}
            <View style={styles.shareFilesBtnTextWrap}>
              <Text style={styles.shareFilesBtnLabel}>{language === 'ar' ? 'تصدير ومشاركة الملفات' : 'Export & Share Files'}</Text>
              <Text style={styles.shareFilesBtnSub}>
                {language === 'ar' ? `PDF وDWG فقط • ${pdfFiles.length + dwgFiles.length} ملف` : `PDF & DWG only • ${pdfFiles.length + dwgFiles.length} file(s)`}
              </Text>
            </View>
            <View style={styles.shareFilesCount}>
              <Text style={styles.shareFilesCountText}>{pdfFiles.length + dwgFiles.length}</Text>
            </View>
          </Pressable>
        </SectionCard>
      </ScrollView>

      {/* ── Signature Pad Modal ──────────────────────────────────────────────── */}
      <Modal visible={showSignaturePad} animationType="slide" statusBarTranslucent onRequestClose={() => setShowSignaturePad(false)}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <View style={[styles.sigModal, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          {/* Header */}
          <View style={[styles.sigModalHeader, isRTL && styles.rtlRow]}>
            <Pressable onPress={() => setShowSignaturePad(false)} hitSlop={12}
              style={({ pressed }) => [styles.sigModalClose, pressed && { opacity: 0.7 }]}>
              <MaterialIcons name="close" size={24} color={Colors.text} />
            </Pressable>
            <Text style={[styles.sigModalTitle, isRTL && styles.rtlText]}>
              {language === 'ar' ? 'التوقيع الإلكتروني' : 'Electronic Signature'}
            </Text>
            <Pressable onPress={handleClearSignaturePad} hitSlop={8}
              style={({ pressed }) => [styles.sigModalClear, pressed && { opacity: 0.7 }]}>
              <Text style={styles.sigModalClearText}>{language === 'ar' ? 'مسح' : 'Clear'}</Text>
            </Pressable>
          </View>

          {/* Sub-label */}
          <Text style={[styles.sigModalHint, isRTL && styles.rtlText]}>
            {language === 'ar' ? 'ارسم توقيعك في المربع أدناه' : 'Draw your signature in the box below'}
          </Text>

          {/* Canvas */}
          <View style={styles.sigCanvasWrap}>
            <SigPathsView />
          </View>

          {/* Confirm */}
          <Pressable onPress={handleConfirmSignature}
            style={({ pressed }) => [styles.sigConfirmBtn, pressed && { opacity: 0.85 }]}>
            <MaterialIcons name="check-circle" size={22} color="#fff" />
            <Text style={styles.sigConfirmBtnText}>
              {language === 'ar' ? 'تأكيد التوقيع' : 'Confirm Signature'}
            </Text>
          </Pressable>
        </View>
      </Modal>

      {/* ── Camera Modal ─────────────────────────────────────────────────────── */}
      <Modal visible={showCamera} animationType="slide" statusBarTranslucent onRequestClose={handleCloseCamera}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.cameraModal}>
          {capturedPreview ? (
            <>
              <Image source={{ uri: capturedPreview }} style={styles.previewFull} contentFit="contain" />
              <View style={[styles.camTopBar, { paddingTop: insets.top + 8 }]}>
                <Text style={styles.camTopLabel}>{language === 'ar' ? 'معاينة الصورة' : 'Photo Preview'}</Text>
              </View>
              <View style={[styles.previewActions, { paddingBottom: insets.bottom + 24 }]}>
                <Pressable onPress={handleRetakePhoto} style={({ pressed }) => [styles.previewActionBtn, styles.retakeBtn, pressed && { opacity: 0.8 }]}>
                  <MaterialIcons name="replay" size={22} color="#fff" />
                  <Text style={styles.previewActionText}>{language === 'ar' ? 'إعادة التصوير' : 'Retake'}</Text>
                </Pressable>
                <Pressable onPress={handleConfirmPhoto} style={({ pressed }) => [styles.previewActionBtn, styles.confirmBtn, pressed && { opacity: 0.85 }]}>
                  <MaterialIcons name="check" size={22} color="#fff" />
                  <Text style={styles.previewActionText}>{language === 'ar' ? 'استخدام الصورة' : 'Use Photo'}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <CameraView ref={cameraRef} style={styles.cameraView} facing={cameraFacing} />
              <View style={[styles.camTopBar, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={handleCloseCamera} style={({ pressed }) => [styles.camIconBtn, pressed && { opacity: 0.7 }]} hitSlop={12}>
                  <MaterialIcons name="close" size={26} color="#fff" />
                </Pressable>
                <Text style={styles.camTopLabel}>{language === 'ar' ? 'التقاط صورة' : 'Take Photo'}</Text>
                <Pressable onPress={() => setCameraFacing(f => f === 'back' ? 'front' : 'back')}
                  style={({ pressed }) => [styles.camIconBtn, pressed && { opacity: 0.7 }]} hitSlop={12}>
                  <MaterialIcons name="flip-camera-android" size={26} color="#fff" />
                </Pressable>
              </View>
              <View style={[styles.camControls, { paddingBottom: insets.bottom + 32 }]}>
                <Text style={styles.camGuideText}>
                  {language === 'ar' ? 'وجّه الكاميرا نحو الهدف واضغط زر التصوير' : 'Point the camera and press capture'}
                </Text>
                <View style={styles.shutterRow}>
                  <View style={styles.thumbPlaceholder} />
                  <Pressable onPress={handleTakePicture} disabled={isCapturing}
                    style={({ pressed }) => [styles.shutterBtn, pressed && { transform: [{ scale: 0.93 }] }, isCapturing && { opacity: 0.6 }]}>
                    {isCapturing ? <ActivityIndicator color={Colors.primary} size="small" /> : <View style={styles.shutterInner} />}
                  </Pressable>
                  <Pressable onPress={() => setCameraFacing(f => f === 'back' ? 'front' : 'back')}
                    style={({ pressed }) => [styles.camFlipSmall, pressed && { opacity: 0.7 }]} hitSlop={8}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md },

  // Edit banner
  editBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.primary + '14', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1.5, borderColor: Colors.primary + '40' },
  editBannerIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary + '22', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  editBannerTextWrap: { flex: 1 },
  editBannerTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.primaryDark },
  editBannerSub: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 2 },

  // Header
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rtlRow: { flexDirection: 'row-reverse' },
  rtlInfo: { alignItems: 'flex-end' },
  logo: { width: 44, height: 44, borderRadius: 8 },
  bannerTitle: { fontSize: FontSize.bodyLg, fontWeight: FontWeight.bold, color: Colors.primary },
  bannerDate: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  reportIdBadge: { backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 80 },
  reportIdBadgeLabel: { fontSize: 9, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: FontWeight.semibold },
  reportIdBadgeValue: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#fff', letterSpacing: 0.5 },

  // Camera main button
  cameraBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, gap: 12, ...Shadow.md },
  cameraBtnPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  cameraBtnIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  cameraBtnTextWrap: { flex: 1 },
  cameraBtnLabel: { fontSize: FontSize.bodyLg, fontWeight: FontWeight.bold, color: '#fff' },
  cameraBtnSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  // 3-column action grid
  actionGrid: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { flex: 1, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: Spacing.sm, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.cardBorder },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  actionIcon: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.text, textAlign: 'center', lineHeight: 17 },
  dwgBtn: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  dwgBtnPressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  dwgBtnLabel: { color: '#fff' },

  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoItem: { position: 'relative' },
  photoThumb: { width: 90, height: 90, borderRadius: Radius.sm },
  removeBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },

  // Files
  fileItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm, padding: Spacing.sm, marginBottom: Spacing.xs },
  fileName: { flex: 1, fontSize: FontSize.sm, color: Colors.text },

  // Voice hint
  voiceHint: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceAlt, padding: Spacing.sm, borderRadius: Radius.sm, marginTop: Spacing.xs },
  voiceHintText: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1, lineHeight: 16 },

  // ── Signature ──────────────────────────────────────────────────────────────
  sigInviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.primary + '0D', borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary + '35', borderStyle: 'dashed', marginBottom: Spacing.sm },
  sigInviteBtnPressed: { opacity: 0.82 },
  sigInviteIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.primary + '18', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  sigInviteTextWrap: { flex: 1 },
  sigInviteTitle: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.primary },
  sigInviteSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 3 },

  sigPreviewWrap: { marginBottom: Spacing.sm },
  sigPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.cardBorder },
  sigPreviewImgBox: { width: 120, height: 60, borderRadius: Radius.sm, backgroundColor: '#fff', borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  sigPreviewImg: { width: 120, height: 60 },
  sigPreviewInfo: { flex: 1, gap: 4 },
  sigDoneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.success + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  sigDoneBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.success },
  signerNameText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.text },
  sigDateText: { fontSize: FontSize.xs, color: Colors.textMuted },
  sigActionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  sigActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radius.md },
  sigEditBtn: { backgroundColor: Colors.primary + '14', borderWidth: 1, borderColor: Colors.primary + '30' },
  sigEditBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primary },
  sigClearBtn: { backgroundColor: Colors.error + '10', borderWidth: 1, borderColor: Colors.error + '25' },
  sigClearBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.error },

  // Signature Modal
  sigModal: { flex: 1, backgroundColor: Colors.background },
  sigModalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.divider, gap: 8 },
  sigModalClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' },
  sigModalTitle: { flex: 1, fontSize: FontSize.subtitle, fontWeight: FontWeight.bold, color: Colors.primary, textAlign: 'center' },
  sigModalClear: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.error + '14', borderRadius: Radius.sm },
  sigModalClearText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.error },
  sigModalHint: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  sigCanvasWrap: { flex: 1, marginHorizontal: Spacing.md, marginBottom: Spacing.md, backgroundColor: '#fff', borderRadius: Radius.lg, borderWidth: 2, borderColor: Colors.border, overflow: 'hidden' },
  sigCanvas: { flex: 1, position: 'relative' },
  sigPlaceholder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', gap: 8 },
  sigPlaceholderText: { fontSize: FontSize.body, color: Colors.border },
  sigConfirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.primary, borderRadius: Radius.md, marginHorizontal: Spacing.md, marginBottom: Spacing.md, paddingVertical: 16, ...Shadow.md },
  sigConfirmBtnText: { fontSize: FontSize.bodyLg, fontWeight: FontWeight.bold, color: '#fff' },

  // Action buttons
  btnGrid: { flexDirection: 'row', gap: Spacing.sm },
  halfBtn: { flex: 1 },
  rtlText: { textAlign: 'right' },

  // Share Files
  shareFilesBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.primaryDark, borderRadius: Radius.md, paddingVertical: 14, paddingHorizontal: Spacing.md, marginTop: Spacing.sm, ...Shadow.sm },
  shareFilesBtnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  shareFilesBtnTextWrap: { flex: 1 },
  shareFilesBtnLabel: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: '#fff' },
  shareFilesBtnSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.72)', marginTop: 2 },
  shareFilesCount: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  shareFilesCountText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#fff' },

  // Camera Modal
  cameraModal: { flex: 1, backgroundColor: '#000' },
  cameraView: { flex: 1 },
  previewFull: { flex: 1, backgroundColor: '#000' },
  camTopBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, backgroundColor: 'rgba(0,0,0,0.45)' },
  camTopLabel: { color: '#fff', fontSize: FontSize.bodyLg, fontWeight: FontWeight.semibold },
  camIconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  camControls: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', paddingTop: Spacing.md, paddingHorizontal: Spacing.lg, alignItems: 'center', gap: Spacing.md },
  camGuideText: { color: 'rgba(255,255,255,0.7)', fontSize: FontSize.sm, textAlign: 'center' },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  thumbPlaceholder: { width: 48, height: 48 },
  shutterBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 3, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  camFlipSmall: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  previewActions: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, backgroundColor: 'rgba(0,0,0,0.6)' },
  previewActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: Radius.md },
  retakeBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  confirmBtn: { backgroundColor: Colors.primary },
  previewActionText: { color: '#fff', fontSize: FontSize.body, fontWeight: FontWeight.semibold },
});
