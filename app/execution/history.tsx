import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useApp, useTranslation } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { ScreenHeader, SectionCard } from '@/components';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';
import {
  AnyReport,
  getAllReports,
  deleteNotebookEntry,
  deleteVisitReport,
  renameNotebookEntry,
  renameVisitReport,
  createBackup,
  restoreBackup,
} from '@/services/storage';

type SortOrder = 'newest' | 'oldest';
type FilterType = 'all' | 'notebook' | 'visit';

export default function HistoryScreen() {
  const { isRTL } = useApp();
  const { t, language } = useTranslation();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [reports, setReports] = useState<AnyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Filter / Search / Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [showSortModal, setShowSortModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);

  // Rename modal state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<AnyReport | null>(null);
  const [renameText, setRenameText] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const renameInputRef = useRef<TextInput>(null);

  // Expandable project sections
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAllReports();
      setReports(data);
      const projects = new Set(data.map(r => r.projectName || t('unnamedProject')));
      setExpandedProjects(projects);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Derived: all unique project names
  const allProjects = useMemo(() => {
    const names = reports.map(r => r.projectName || t('unnamedProject'));
    return ['', ...Array.from(new Set(names))];
  }, [reports]);

  // Filtered & sorted reports
  const filteredReports = useMemo(() => {
    let result = [...reports];

    if (filterType !== 'all') {
      result = result.filter(r => r.type === filterType);
    }

    if (selectedProject) {
      result = result.filter(
        r => (r.projectName || t('unnamedProject')) === selectedProject
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => {
        const proj = (r.projectName || '').toLowerCase();
        const name = (r.reportName || '').toLowerCase();
        const date = r.date.toLowerCase();
        const type = r.type === 'notebook' ? t('typeNotebook') : t('typeVisit');
        let textContent = '';
        if (r.type === 'notebook') {
          textContent = [r.dailyTasks, r.activeWorkshops, r.activeMachines, r.projectWorkers]
            .join(' ').toLowerCase();
        } else {
          textContent = r.notes.toLowerCase();
        }
        return proj.includes(q) || name.includes(q) || date.includes(q) || textContent.includes(q) || type.toLowerCase().includes(q);
      });
    }

    result.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? db - da : da - db;
    });

    return result;
  }, [reports, filterType, selectedProject, searchQuery, sortOrder]);

  // Group by project
  const grouped = useMemo(() => {
    const groups: Record<string, AnyReport[]> = {};
    for (const r of filteredReports) {
      const key = r.projectName || t('unnamedProject');
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return groups;
  }, [filteredReports]);

  const projectKeys = useMemo(() => Object.keys(grouped), [grouped]);

  // ─── Edit ─────────────────────────────────────────────────────────────────────

  const handleEdit = (report: AnyReport) => {
    if (report.type === 'notebook') {
      router.push(`/execution/workshop-notebook?editId=${report.id}` as any);
    } else {
      router.push(`/execution/visit-report?editId=${report.id}` as any);
    }
  };

  // ─── Rename ───────────────────────────────────────────────────────────────────

  const handleOpenRename = (report: AnyReport) => {
    setRenameTarget(report);
    setRenameText(report.reportName || getReportDisplayName(report));
    setShowRenameModal(true);
    setTimeout(() => renameInputRef.current?.focus(), 300);
  };

  const handleConfirmRename = async () => {
    if (!renameTarget || !renameText.trim()) return;
    setIsRenaming(true);
    try {
      if (renameTarget.type === 'notebook') {
        await renameNotebookEntry(renameTarget.id, renameText.trim());
      } else {
        await renameVisitReport(renameTarget.id, renameText.trim());
      }
      setShowRenameModal(false);
      setRenameTarget(null);
      await loadReports();
      showAlert(t('success'), t('reportRenamed'));
    } catch (e) {
      showAlert(t('error'), String(e));
    } finally {
      setIsRenaming(false);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = (report: AnyReport) => {
    showAlert(
      language === 'ar' ? 'حذف التقرير' : 'Delete Report',
      t('deleteConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              if (report.type === 'notebook') {
                await deleteNotebookEntry(report.id);
              } else {
                await deleteVisitReport(report.id);
              }
              await loadReports();
            } catch (e) {
              showAlert(t('error'), String(e));
            }
          },
        },
      ]
    );
  };

  // ─── Backup ───────────────────────────────────────────────────────────────────

  const handleBackup = async () => {
    if (reports.length === 0) {
      showAlert(language === 'ar' ? 'لا توجد بيانات' : 'No Data', t('noBackupData'));
      return;
    }
    setIsBackingUp(true);
    try {
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        showAlert(t('error'), language === 'ar' ? 'المشاركة غير متاحة' : 'Sharing not available');
        return;
      }
      const jsonStr = await createBackup();
      const filename = `RBFWorks_Backup_${new Date().toISOString().split('T')[0]}.json`;
      const dest = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(dest, jsonStr, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(dest, {
        mimeType: 'application/json',
        dialogTitle: language === 'ar' ? 'مشاركة النسخة الاحتياطية' : 'Share Backup',
      });
    } catch (e) {
      showAlert(t('error'), String(e));
    } finally {
      setIsBackingUp(false);
    }
  };

  // ─── Restore ──────────────────────────────────────────────────────────────────

  const handleRestore = () => {
    showAlert(
      language === 'ar' ? 'استرجاع البيانات' : 'Restore Data',
      t('restoreConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('restoreMerge'), onPress: () => pickAndRestore('merge') },
        { text: t('restoreReplace'), style: 'destructive', onPress: () => pickAndRestore('replace') },
      ]
    );
  };

  const pickAndRestore = async (mode: 'merge' | 'replace') => {
    setIsRestoring(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const { notebooks, visits } = await restoreBackup(content, mode);
      await loadReports();
      showAlert(
        t('success'),
        language === 'ar'
          ? `تم استرجاع ${notebooks} دفتر ورشة و${visits} تقرير زيارة`
          : `Restored ${notebooks} notebook(s) and ${visits} visit report(s)`
      );
    } catch (e) {
      const msg = String(e);
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('json')) {
        showAlert(t('error'), t('invalidBackup'));
      } else {
        showAlert(t('error'), msg);
      }
    } finally {
      setIsRestoring(false);
    }
  };

  // ─── Toggle expand ────────────────────────────────────────────────────────────

  const toggleProject = (key: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch { return iso; }
  };

  const getReportDisplayName = (report: AnyReport): string => {
    if (report.reportName) return report.reportName;
    const type = report.type === 'notebook'
      ? (language === 'ar' ? 'دفتر الورشة' : 'Notebook')
      : (language === 'ar' ? 'تقرير الزيارة' : 'Visit Report');
    return `${type} – ${formatDate(report.date)}`;
  };

  const getReportSummary = (report: AnyReport): string => {
    if (report.type === 'notebook') {
      const tasks = report.dailyTasks?.trim();
      return tasks
        ? tasks.substring(0, 80) + (tasks.length > 80 ? '…' : '')
        : language === 'ar' ? 'لا توجد مهام مسجلة' : 'No tasks recorded';
    } else {
      const notes = report.notes?.trim();
      if (notes) return notes.substring(0, 80) + (notes.length > 80 ? '…' : '');
      const counts = [];
      if (report.photos?.length) counts.push(`${report.photos.length} ${language === 'ar' ? 'صورة' : 'photo(s)'}`);
      if (report.pdfFiles?.length) counts.push(`${report.pdfFiles.length} PDF`);
      if (report.dwgFiles?.length) counts.push(`${report.dwgFiles.length} DWG`);
      return counts.join(' · ') || (language === 'ar' ? 'لا توجد ملاحظات' : 'No notes');
    }
  };

  // ─── Sub-components ───────────────────────────────────────────────────────────

  const renderReport = (report: AnyReport) => {
    const isNotebook = report.type === 'notebook';
    const displayName = getReportDisplayName(report);
    const hasCustomName = !!report.reportName;

    return (
      <View key={report.id} style={styles.reportCard}>
        {/* Top row: type badge + content */}
        <View style={[styles.reportTop, isRTL && styles.rtlRow]}>
          {/* Type Badge */}
          <View style={[styles.typeBadgeWrap, isNotebook ? styles.typeBadgeNb : styles.typeBadgeVr]}>
            {isNotebook
              ? <MaterialCommunityIcons name="notebook-edit" size={20} color={Colors.primary} />
              : <MaterialCommunityIcons name="clipboard-text-search" size={20} color={Colors.primaryDark} />}
          </View>

          {/* Content */}
          <View style={[styles.reportContent, isRTL && { alignItems: 'flex-end' }]}>
            {/* Display name (custom or auto) */}
            <Text style={[styles.reportDisplayName, isRTL && styles.rtlText]} numberOfLines={1}>
              {displayName}
            </Text>

            <View style={[styles.reportMeta, isRTL && styles.rtlRow]}>
              <View style={[styles.typePill, isNotebook ? styles.typePillNb : styles.typePillVr]}>
                <Text style={[styles.typePillText, isNotebook ? styles.typePillTextNb : styles.typePillTextVr]}>
                  {isNotebook ? t('typeNotebook') : t('typeVisit')}
                </Text>
              </View>
              <Text style={styles.reportDate}>{formatDate(report.date)}</Text>
              {hasCustomName ? (
                <View style={styles.renamedBadge}>
                  <MaterialIcons name="edit" size={10} color={Colors.primary} />
                </View>
              ) : null}
            </View>

            <Text style={[styles.reportSummary, isRTL && styles.rtlText]} numberOfLines={2}>
              {getReportSummary(report)}
            </Text>
          </View>
        </View>

        {/* Action row: Edit, Rename, Delete */}
        <View style={[styles.reportActions, isRTL && styles.rtlRow]}>
          {/* Edit */}
          <Pressable
            onPress={() => handleEdit(report)}
            style={({ pressed }) => [styles.reportActionBtn, styles.editBtn, pressed && { opacity: 0.75 }]}
          >
            <MaterialIcons name="edit" size={15} color={Colors.primary} />
            <Text style={styles.editBtnText}>
              {language === 'ar' ? 'تعديل' : 'Edit'}
            </Text>
          </Pressable>

          {/* Rename */}
          <Pressable
            onPress={() => handleOpenRename(report)}
            style={({ pressed }) => [styles.reportActionBtn, styles.renameBtn, pressed && { opacity: 0.75 }]}
          >
            <MaterialIcons name="drive-file-rename-outline" size={15} color={Colors.primaryDark} />
            <Text style={styles.renameBtnText}>
              {language === 'ar' ? 'إعادة تسمية' : 'Rename'}
            </Text>
          </Pressable>

          {/* Delete */}
          <Pressable
            onPress={() => handleDelete(report)}
            style={({ pressed }) => [styles.reportActionBtn, styles.deleteActionBtn, pressed && { opacity: 0.75 }]}
            hitSlop={4}
          >
            <MaterialIcons name="delete-outline" size={15} color={Colors.error} />
            <Text style={styles.deleteBtnText}>
              {language === 'ar' ? 'حذف' : 'Delete'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderProjectSection = (projectKey: string) => {
    const items = grouped[projectKey] || [];
    const isExpanded = expandedProjects.has(projectKey);
    return (
      <View key={projectKey} style={styles.projectSection}>
        <Pressable
          onPress={() => toggleProject(projectKey)}
          style={({ pressed }) => [styles.projectHeader, isRTL && styles.rtlRow, pressed && { opacity: 0.8 }]}
        >
          <View style={styles.projectAccent} />
          <MaterialIcons name="folder" size={22} color={Colors.primary} />
          <Text style={[styles.projectName, isRTL && styles.rtlText]} numberOfLines={1}>
            {projectKey}
          </Text>
          <View style={styles.projectCount}>
            <Text style={styles.projectCountText}>{items.length}</Text>
          </View>
          <MaterialIcons
            name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
            size={22}
            color={Colors.textMuted}
          />
        </Pressable>
        {isExpanded ? (
          <View style={styles.reportList}>
            {items.map(r => renderReport(r))}
          </View>
        ) : null}
      </View>
    );
  };

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
        title={language === 'ar' ? t('myFiles') : 'My Files'}
        subtitle={language === 'ar' ? 'My Files / ملفاتي' : 'ملفاتي / My Files'}
        isRTL={isRTL}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Search Bar ─────────────────────────────────────────────────── */}
        <View style={[styles.searchRow, isRTL && styles.rtlRow]}>
          <MaterialIcons name="search" size={22} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, isRTL && styles.rtlText]}
            placeholder={t('searchPlaceholder')}
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            textAlign={isRTL ? 'right' : 'left'}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <MaterialIcons name="close" size={18} color={Colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* ── Filter / Sort Strip ────────────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filterStrip, isRTL && { flexDirection: 'row-reverse' }]}
        >
          {(['all', 'notebook', 'visit'] as FilterType[]).map(ft => (
            <Pressable
              key={ft}
              onPress={() => setFilterType(ft)}
              style={[styles.filterChip, filterType === ft && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, filterType === ft && styles.filterChipTextActive]}>
                {ft === 'all' ? t('filterAll') : ft === 'notebook' ? t('filterNotebook') : t('filterVisit')}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setShowProjectModal(true)}
            style={[styles.filterChip, selectedProject ? styles.filterChipActive : undefined]}
          >
            <MaterialIcons name="folder-open" size={14} color={selectedProject ? '#fff' : Colors.textSecondary} />
            <Text style={[styles.filterChipText, selectedProject && styles.filterChipTextActive]}>
              {selectedProject || t('allProjects')}
            </Text>
          </Pressable>
          <Pressable onPress={() => setShowSortModal(true)} style={styles.filterChip}>
            <MaterialIcons name="sort" size={14} color={Colors.textSecondary} />
            <Text style={styles.filterChipText}>
              {sortOrder === 'newest' ? t('sortNewest') : t('sortOldest')}
            </Text>
          </Pressable>
        </ScrollView>

        {/* ── Stats Row ─────────────────────────────────────────────────── */}
        <View style={[styles.statsRow, isRTL && styles.rtlRow]}>
          <View style={[styles.statChip, { backgroundColor: Colors.primary + '18' }]}>
            <MaterialCommunityIcons name="notebook-edit" size={14} color={Colors.primary} />
            <Text style={[styles.statText, { color: Colors.primary }]}>
              {reports.filter(r => r.type === 'notebook').length} {t('typeNotebook')}
            </Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: Colors.primaryDark + '18' }]}>
            <MaterialCommunityIcons name="clipboard-text-search" size={14} color={Colors.primaryDark} />
            <Text style={[styles.statText, { color: Colors.primaryDark }]}>
              {reports.filter(r => r.type === 'visit').length} {t('typeVisit')}
            </Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: Colors.accent + '20' }]}>
            <MaterialIcons name="folder" size={14} color={Colors.accent} />
            <Text style={[styles.statText, { color: Colors.accent }]}>
              {allProjects.length - 1} {language === 'ar' ? 'مشروع' : 'Project(s)'}
            </Text>
          </View>
        </View>

        {/* ── Backup / Restore Buttons ──────────────────────────────────── */}
        <View style={[styles.backupRow, isRTL && styles.rtlRow]}>
          <Pressable
            onPress={handleBackup}
            disabled={isBackingUp}
            style={({ pressed }) => [styles.backupBtn, pressed && styles.btnPressed, isBackingUp && { opacity: 0.65 }]}
          >
            {isBackingUp
              ? <ActivityIndicator color="#fff" size="small" />
              : <MaterialIcons name="backup" size={20} color="#fff" />}
            <Text style={styles.backupBtnText}>{language === 'ar' ? t('backup') : 'Backup'}</Text>
            {!isRTL
              ? <Text style={styles.backupBtnSub}>نسخ احتياطي</Text>
              : <Text style={styles.backupBtnSub}>Backup</Text>}
          </Pressable>
          <Pressable
            onPress={handleRestore}
            disabled={isRestoring}
            style={({ pressed }) => [styles.restoreBtn, pressed && styles.btnPressed, isRestoring && { opacity: 0.65 }]}
          >
            {isRestoring
              ? <ActivityIndicator color={Colors.primary} size="small" />
              : <MaterialIcons name="restore" size={20} color={Colors.primary} />}
            <Text style={styles.restoreBtnText}>{language === 'ar' ? t('restore') : 'Restore'}</Text>
            {!isRTL
              ? <Text style={styles.restoreBtnSub}>استرجاع</Text>
              : <Text style={styles.restoreBtnSub}>Restore</Text>}
          </Pressable>
        </View>

        {/* ── File List (Grouped by Project) ─────────────────────────────── */}
        {filteredReports.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="folder-open" size={56} color={Colors.border} />
            <Text style={[styles.emptyTitle, isRTL && styles.rtlText]}>
              {searchQuery || selectedProject || filterType !== 'all'
                ? t('noSearchResults')
                : t('noReports')}
            </Text>
            <Text style={[styles.emptySub, isRTL && styles.rtlText]}>
              {language === 'ar'
                ? 'احفظ تقاريرك من شاشات دفتر الورشة أو تقرير الزيارة'
                : 'Save reports from Workshop Notebook or Visit Report screens'}
            </Text>
          </View>
        ) : (
          projectKeys.map(k => renderProjectSection(k))
        )}
      </ScrollView>

      {/* ── Rename Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={showRenameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRenameModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowRenameModal(false)}
        >
          <Pressable style={[styles.renameDialog, { marginBottom: insets.bottom + 20 }]} onPress={() => {}}>
            {/* Header */}
            <View style={[styles.renameDialogHeader, isRTL && styles.rtlRow]}>
              <View style={styles.renameDialogIcon}>
                <MaterialIcons name="drive-file-rename-outline" size={22} color={Colors.primary} />
              </View>
              <Text style={[styles.renameDialogTitle, isRTL && styles.rtlText]}>
                {t('renameReport')}
              </Text>
            </View>

            {/* Input */}
            <TextInput
              ref={renameInputRef}
              style={[styles.renameInput, isRTL && styles.rtlText]}
              value={renameText}
              onChangeText={setRenameText}
              placeholder={t('renameHint')}
              placeholderTextColor={Colors.textMuted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleConfirmRename}
              textAlign={isRTL ? 'right' : 'left'}
              maxLength={60}
            />
            <Text style={[styles.renameCharCount, isRTL && { textAlign: 'left' }]}>
              {renameText.length}/60
            </Text>

            {/* Buttons */}
            <View style={[styles.renameDialogBtns, isRTL && styles.rtlRow]}>
              <Pressable
                onPress={() => setShowRenameModal(false)}
                style={({ pressed }) => [styles.renameDialogBtn, styles.renameCancelBtn, pressed && { opacity: 0.75 }]}
              >
                <Text style={styles.renameCancelText}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmRename}
                disabled={isRenaming || !renameText.trim()}
                style={({ pressed }) => [
                  styles.renameDialogBtn,
                  styles.renameConfirmBtn,
                  pressed && { opacity: 0.85 },
                  (!renameText.trim() || isRenaming) && { opacity: 0.5 },
                ]}
              >
                {isRenaming
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.renameConfirmText}>{t('renameConfirm')}</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Sort Modal ──────────────────────────────────────────────────── */}
      <Modal visible={showSortModal} transparent animationType="slide" onRequestClose={() => setShowSortModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSortModal(false)}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {language === 'ar' ? 'ترتيب النتائج' : 'Sort Results'}
            </Text>
            {(['newest', 'oldest'] as SortOrder[]).map(opt => (
              <Pressable
                key={opt}
                onPress={() => { setSortOrder(opt); setShowSortModal(false); }}
                style={({ pressed }) => [styles.modalOption, isRTL && styles.rtlRow, pressed && { backgroundColor: Colors.surfaceAlt }]}
              >
                <MaterialIcons name={opt === 'newest' ? 'arrow-downward' : 'arrow-upward'} size={20} color={Colors.primary} />
                <Text style={[styles.modalOptionText, isRTL && styles.rtlText]}>
                  {opt === 'newest' ? t('sortNewest') : t('sortOldest')}
                </Text>
                {sortOrder === opt
                  ? <MaterialIcons name="check-circle" size={20} color={Colors.accent} style={{ marginLeft: 'auto' }} />
                  : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ── Project Filter Modal ─────────────────────────────────────────── */}
      <Modal visible={showProjectModal} transparent animationType="slide" onRequestClose={() => setShowProjectModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowProjectModal(false)}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, isRTL && styles.rtlText]}>
              {language === 'ar' ? 'تصفية حسب المشروع' : 'Filter by Project'}
            </Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {allProjects.map((proj, i) => (
                <Pressable
                  key={i}
                  onPress={() => { setSelectedProject(proj); setShowProjectModal(false); }}
                  style={({ pressed }) => [styles.modalOption, isRTL && styles.rtlRow, pressed && { backgroundColor: Colors.surfaceAlt }]}
                >
                  <MaterialIcons name={proj ? 'folder' : 'folder-open'} size={20} color={Colors.primary} />
                  <Text style={[styles.modalOptionText, isRTL && styles.rtlText]}>
                    {proj || t('allProjects')}
                  </Text>
                  {selectedProject === proj
                    ? <MaterialIcons name="check-circle" size={20} color={Colors.accent} style={{ marginLeft: 'auto' }} />
                    : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.md, gap: Spacing.sm },

  // Search
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
    ...Shadow.sm,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: FontSize.body, color: Colors.text, paddingVertical: 0 },

  // Filter strip
  filterStrip: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  filterChipTextActive: { color: '#fff' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  // Backup / Restore
  backupRow: { flexDirection: 'row', gap: Spacing.sm },
  backupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 13,
    paddingHorizontal: Spacing.sm,
    ...Shadow.sm,
  },
  restoreBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: 13,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    ...Shadow.sm,
  },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  backupBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: '#fff' },
  backupBtnSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.65)' },
  restoreBtnText: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: Colors.primary },
  restoreBtnSub: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Project sections
  projectSection: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
  },
  projectAccent: { width: 3, height: 20, backgroundColor: Colors.primary, borderRadius: 2 },
  projectName: { flex: 1, fontSize: FontSize.bodyLg, fontWeight: FontWeight.bold, color: Colors.text },
  projectCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary + '22',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  projectCountText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary },
  reportList: { padding: Spacing.sm, gap: Spacing.xs },

  // Report card
  reportCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: Spacing.xs,
    overflow: 'hidden',
  },
  reportTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: Spacing.sm,
  },
  typeBadgeWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  typeBadgeNb: { backgroundColor: Colors.primary + '18' },
  typeBadgeVr: { backgroundColor: Colors.primaryDark + '18' },
  reportContent: { flex: 1, gap: 4 },
  reportDisplayName: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    lineHeight: 20,
  },
  reportMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  typePill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typePillNb: { backgroundColor: Colors.primary + '18' },
  typePillVr: { backgroundColor: Colors.primaryDark + '18' },
  typePillText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  typePillTextNb: { color: Colors.primary },
  typePillTextVr: { color: Colors.primaryDark },
  reportDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  renamedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary + '25',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportSummary: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Action row inside card
  reportActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.surfaceAlt,
  },
  reportActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  editBtn: {
    borderRightWidth: 1,
    borderRightColor: Colors.divider,
  },
  editBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primary },
  renameBtn: {
    borderRightWidth: 1,
    borderRightColor: Colors.divider,
  },
  renameBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primaryDark },
  deleteActionBtn: {},
  deleteBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.error },

  // Rename dialog
  renameDialog: {
    margin: 24,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    ...Shadow.lg,
  },
  renameDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.md,
  },
  renameDialogIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameDialogTitle: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    flex: 1,
  },
  renameInput: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    fontSize: FontSize.bodyLg,
    color: Colors.text,
    marginBottom: 4,
  },
  renameCharCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginBottom: Spacing.md,
  },
  renameDialogBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  renameDialogBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameCancelBtn: {
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  renameCancelText: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  renameConfirmBtn: { backgroundColor: Colors.primary },
  renameConfirmText: { fontSize: FontSize.body, fontWeight: FontWeight.bold, color: '#fff' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: {
    fontSize: FontSize.subtitle,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.lg,
  },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
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
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    borderRadius: Radius.sm,
  },
  modalOptionText: { fontSize: FontSize.bodyLg, color: Colors.text },

  // RTL helpers
  rtlRow: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right' },
});
