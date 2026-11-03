import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import AccountModal from './src/components/AccountModal';
import { useAuth } from './src/auth/AuthProvider';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

type Job = {
  id: number;
  title: string;
  description: string;
  area: string;
  category: string;
  dailyPayTry: number;
  workerCount: number;
  workDate: string;
  employerName: string;
  createdAt: string;
  isDemo: boolean;
  status?: 'open' | 'filled' | 'cancelled';
};

type SortOption = 'recent' | 'pay_desc' | 'pay_asc';
type JobDraft = {
  title: string;
  description: string;
  area: string;
  category: string;
  dailyPayTry: string;
  workerCount: string;
  workDate: string;
};

const API_ROOT = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5160/api').replace(/\/$/, '');
const CATEGORIES = ['Tümü', 'Tarım', 'Taşıma', 'Bahçe', 'Temizlik', 'İnşaat', 'Diğer'];
const IZNIK_AREAS = ['İznik merkez', 'Boyalıca', 'Elbeyli'];
const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'recent', label: 'En yeni' },
  { key: 'pay_desc', label: 'Yevmiye: yüksek' },
  { key: 'pay_asc', label: 'Yevmiye: düşük' },
];

function localDateString() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatWorkDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  const today = new Date();
  const todayValue = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dateValue = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysAway = Math.round((dateValue - todayValue) / 86_400_000);
  if (daysAway === 0) return 'Bugün';
  if (daysAway === 1) return 'Yarın';
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(date);
}

function categoryIcon(category: string) {
  switch (category) {
    case 'Tarım': return '🌾';
    case 'Taşıma': return '📦';
    case 'Bahçe': return '🌿';
    case 'Temizlik': return '🧹';
    case 'İnşaat': return '🧱';
    default: return '🛠';
  }
}

function makeEmptyDraft(): JobDraft {
  return {
    title: '',
    description: '',
    area: 'İznik merkez',
    category: 'Tarım',
    dailyPayTry: '',
    workerCount: '1',
    workDate: localDateString(),
  };
}

export default function App() {
  const router = useRouter();
  const { token, user, ready, signOut } = useAuth();
  const { width } = useWindowDimensions();
  const isCompact = width < 720;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [categories, setCategories] = useState(CATEGORIES);
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('İznik');
  const [category, setCategory] = useState('Tümü');
  const [sort, setSort] = useState<SortOption>('recent');
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draft, setDraft] = useState<JobDraft>(makeEmptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!token) { setUnreadCount(0); return; }
    let active = true;
    fetch(`${API_ROOT}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : null)
      .then((count) => { if (active && typeof count === 'number') setUnreadCount(count); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [token, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setLoadError('');
      const params = new URLSearchParams({ page: '1', pageSize: '30', sort });
      if (query.trim()) params.set('search', query.trim());
      if (area.trim()) params.set('area', area.trim());
      if (category !== 'Tümü') params.set('category', category);

      try {
        const response = await fetch(`${API_ROOT}/jobs?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`İlanlar alınamadı (${response.status}).`);
        const data = await response.json() as Job[];
        setJobs(data);
        setTotalCount(Number(response.headers.get('X-Total-Count') || data.length));
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : 'API bağlantısı kurulamadı.');
        setJobs([]);
        setTotalCount(0);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, area, category, sort, refreshKey]);

  const updateDraft = useCallback((key: keyof JobDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);

  const submitJob = useCallback(async () => {
    setFormError('');
    const payload = {
      title: draft.title, description: draft.description, area: draft.area, category: draft.category, workDate: draft.workDate,
      dailyPayTry: Number(draft.dailyPayTry),
      workerCount: Number(draft.workerCount),
    };
    if (!token) { setIsCreateOpen(false); setAccountOpen(true); return; }
    if (!payload.title.trim() || !payload.description.trim() || !payload.area.trim()) {
      setFormError('Başlık, açıklama ve konum zorunludur.');
      return;
    }
    if (!Number.isFinite(payload.dailyPayTry) || payload.dailyPayTry <= 0 || !Number.isInteger(payload.workerCount) || payload.workerCount < 1) {
      setFormError('Yevmiye ve çalışan sayısını kontrol et.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${API_ROOT}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const messages = result?.errors ? Object.values(result.errors).flat().join(' ') : '';
        throw new Error(messages || result?.detail || 'İlan oluşturulamadı.');
      }
      setIsCreateOpen(false);
      setDraft(makeEmptyDraft());
      setSuccessMessage('İlan yayımlandı.');
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'İlan oluşturulamadı.');
    } finally {
      setIsSaving(false);
    }
  }, [draft, token]);

  const resultLabel = useMemo(() => `${totalCount} ilan`, [totalCount]);

  useEffect(() => {
    fetch(`${API_ROOT}/jobs/categories`)
      .then((response) => response.ok ? response.json() as Promise<string[]> : Promise.reject())
      .then((items) => setCategories(['Tümü', ...items]))
      .catch(() => setCategories(CATEGORIES));
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.topShell}>
          <View style={styles.topRow}>
            <View style={styles.brandBlock}>
              <View style={styles.brandMark}><Text style={styles.brandMarkText}>Y</Text></View>
              <View>
                <Text style={styles.brandName}>Yevmiyem</Text>
                <Text style={styles.brandTagline}>İznik’in günlük iş ağı</Text>
              </View>
            </View>
            <View style={styles.accountActions}>
              <Pressable style={styles.headerLink} onPress={() => router.push('/notifications')}><Text style={styles.loginText}>Bildirimler {unreadCount ? `(${unreadCount})` : ''}</Text></Pressable>
              <Pressable style={styles.headerLink} onPress={() => router.push('/preferences')}><Text style={styles.loginText}>Tercihler</Text></Pressable>
              <Pressable style={styles.loginButton} onPress={() => { if (!ready) return; if (user) void signOut(); else setAccountOpen(true); }}>
                <Text style={styles.loginText}>{!ready ? 'Oturum yükleniyor…' : user ? `${user.name} · Çıkış` : 'Giriş yap / Kayıt ol'}</Text>
              </Pressable>
              <Pressable style={styles.postAdButton} onPress={() => { if (!ready) return; if (!token) setAccountOpen(true); else { setFormError(''); setIsCreateOpen(true); } }}>
                <Text style={styles.postAdText}>＋  İş ilanı oluştur</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.searchPanel}>
            <View style={styles.searchField}>
              <Text style={styles.fieldIcon}>⌕</Text>
              <TextInput value={query} onChangeText={setQuery} placeholder="İş, beceri veya ilan ara" placeholderTextColor="#747474" style={styles.searchInput} returnKeyType="search" />
            </View>
            <View style={styles.locationField}>
              <Text style={styles.fieldIcon}>⌖</Text>
              <TextInput value={area} onChangeText={setArea} placeholder="İlçe veya mahalle" placeholderTextColor="#747474" style={styles.locationInput} returnKeyType="search" />
            </View>
            <Pressable style={styles.searchButton} onPress={() => setRefreshKey((current) => current + 1)}>
              <Text style={styles.searchButtonText}>İlan ara</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.areaBar}>
          <Text style={styles.areaBarLabel}>Konum</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.areaQuickList}>
            {['Tümü', ...IZNIK_AREAS].map((item) => {
              const value = item === 'Tümü' ? '' : item;
              const selected = area === value;
              return <Pressable key={item} onPress={() => setArea(value)} style={[styles.areaQuickButton, selected && styles.areaQuickButtonActive]}>
                <Text style={[styles.areaQuickText, selected && styles.areaQuickTextActive]}>{item}</Text>
              </Pressable>;
            })}
          </ScrollView>
        </View>

        <View style={styles.categoryBar}>
          <Text style={styles.categoryLabel}>İş türleri</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
            {categories.map((item) => (
              <Pressable key={item} onPress={() => setCategory(item)} style={[styles.categoryButton, category === item && styles.categoryButtonSelected]}>
                <Text style={[styles.categoryButtonText, category === item && styles.categoryButtonTextSelected]}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.content}>
          <View style={styles.breadcrumb}><Text style={styles.breadcrumbText}>Ana sayfa  ›  Günlük iş ilanları  ›  İznik</Text></View>
          <View style={styles.welcomeBanner}>
            <View style={styles.welcomeCopy}>
              <Text style={styles.welcomeEyebrow}>İZNİK’TE BUGÜN</Text>
              <Text style={styles.welcomeTitle}>İşini bul. Emeğin karşılığını al.</Text>
              <Text style={styles.welcomeBody}>Yakınındaki günlük iş fırsatları burada buluşuyor.</Text>
            </View>
            <View style={styles.locationStamp}><Text style={styles.locationStampIcon}>⌖</Text><Text style={styles.locationStampText}>İZNİK · BURSA</Text></View>
          </View>
          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.pageTitle}>Yakınındaki işler</Text>
              <Text style={styles.pageSubtitle}>İlanları karşılaştır, sana uyanı seç.</Text>
            </View>
            <Pressable style={styles.smallPostButton} onPress={() => { if (!ready) return; if (!token) setAccountOpen(true); else { setFormError(''); setIsCreateOpen(true); } }}>
              <Text style={styles.smallPostButtonText}>＋ İlan oluştur</Text>
            </Pressable>
          </View>

          <View style={styles.toolbar}>
            <Text style={styles.resultCount}>{resultLabel}</Text>
            <View style={styles.sortGroup}>
              <Text style={styles.sortLabel}>Sırala:</Text>
              {SORT_OPTIONS.map((option) => (
                <Pressable key={option.key} onPress={() => setSort(option.key)} style={[styles.sortOption, sort === option.key && styles.sortOptionActive]}>
                  <Text style={[styles.sortOptionText, sort === option.key && styles.sortOptionTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {successMessage ? (
            <Pressable onPress={() => setSuccessMessage('')} style={styles.successBanner}><Text style={styles.successText}>✓  {successMessage}  ·  Kapat</Text></Pressable>
          ) : null}

          {loadError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorTitle}>İlanlara ulaşılamadı</Text>
              <Text style={styles.errorText}>{loadError} API adresini ve bağlantıyı kontrol edip tekrar dene.</Text>
              <Pressable onPress={() => setRefreshKey((current) => current + 1)} style={styles.retryButton}><Text style={styles.retryButtonText}>Tekrar dene</Text></Pressable>
            </View>
          ) : isLoading ? (
            <View style={styles.loadingBox}><ActivityIndicator color="#2C2C2C" /><Text style={styles.loadingText}>İlanlar getiriliyor…</Text></View>
          ) : jobs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>⌕</Text>
              <Text style={styles.emptyTitle}>Bu aramayla eşleşen ilan yok</Text>
              <Text style={styles.emptyText}>Arama kelimesini veya konumu değiştirip tekrar deneyebilirsin.</Text>
            </View>
          ) : (
            <View style={styles.listingList}>
              {jobs.map((job) => (
                <Pressable key={job.id} style={[styles.listingCard, isCompact && styles.listingCardCompact]} onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: String(job.id) } })}>
                  <View style={[styles.listingPicture, isCompact && styles.listingPictureCompact]}>
                    <Text style={styles.listingEmoji}>{categoryIcon(job.category)}</Text>
                    <Text style={styles.pictureCaption}>{job.category}</Text>
                  </View>
                  <View style={[styles.listingMain, isCompact && styles.listingMainCompact]}>
                    <View style={styles.listingTitleRow}>
                      <Text style={styles.listingTitle}>{job.title}</Text>
                      {job.isDemo ? <View style={styles.demoBadge}><Text style={styles.demoBadgeText}>ÖRNEK</Text></View> : null}
                    </View>
                    <Text numberOfLines={2} style={styles.listingDescription}>{job.description}</Text>
                    <Text style={styles.listingMeta}>{job.area}  ·  {formatWorkDate(job.workDate)}  ·  {job.workerCount} kişi aranıyor</Text>
                    <Text style={styles.employerName}>{job.employerName}</Text>
                  </View>
                  <View style={[styles.priceColumn, isCompact && styles.priceColumnCompact]}>
                    <Text style={styles.priceValue}>{new Intl.NumberFormat('tr-TR').format(job.dailyPayTry)} ₺</Text>
                    <Text style={styles.priceUnit}>günlük yevmiye</Text>
                    <Text style={styles.detailLink}>İlanı incele  ›</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
          <Text style={styles.footerNote}>Yevmiyem · Bursa, İznik</Text>
        </View>
      </ScrollView>

      <Modal visible={isCreateOpen} transparent animationType="fade" onRequestClose={() => setIsCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.formCard}>
            <View style={styles.formHeading}>
              <View><Text style={styles.formTitle}>Ücretsiz iş ilanı ver</Text><Text style={styles.formSubtitle}>İznik’te çalışacak kişileri bul.</Text></View>
              <Pressable onPress={() => setIsCreateOpen(false)} style={styles.closeButton}><Text style={styles.closeButtonText}>×</Text></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.formScroll}>
              <FormField label="İlan başlığı" value={draft.title} onChangeText={(value) => updateDraft('title', value)} placeholder="Örn. Zeytin hasadında çalışacak kişiler" />
              <FormField label="İş açıklaması" value={draft.description} onChangeText={(value) => updateDraft('description', value)} placeholder="İşin detaylarını yaz" multiline />
              <FormField label="Konum" value={draft.area} onChangeText={(value) => updateDraft('area', value)} placeholder="İznik merkez, Boyalıca…" />
              <Text style={styles.formHint}>Konum seç veya mahalle/köy adını kendin yaz.</Text>
              <View style={styles.formCategoryRow}>
                {IZNIK_AREAS.map((item) => (
                  <Pressable key={item} onPress={() => updateDraft('area', item)} style={[styles.formCategory, draft.area === item && styles.formCategoryActive]}>
                    <Text style={[styles.formCategoryText, draft.area === item && styles.formCategoryTextActive]}>{item}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.formLabel}>Kategori</Text>
              <View style={styles.formCategoryRow}>
                {categories.filter((item) => item !== 'Tümü').map((item) => (
                  <Pressable key={item} onPress={() => updateDraft('category', item)} style={[styles.formCategory, draft.category === item && styles.formCategoryActive]}>
                    <Text style={[styles.formCategoryText, draft.category === item && styles.formCategoryTextActive]}>{item}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.formTwoColumns}>
                <View style={styles.formHalf}><FormField label="Yevmiye (₺)" value={draft.dailyPayTry} onChangeText={(value) => updateDraft('dailyPayTry', value)} placeholder="1200" keyboardType="numeric" /></View>
                <View style={styles.formHalf}><FormField label="Kişi sayısı" value={draft.workerCount} onChangeText={(value) => updateDraft('workerCount', value)} placeholder="1" keyboardType="numeric" /></View>
              </View>
              <FormField label="Çalışma tarihi (YYYY-AA-GG)" value={draft.workDate} onChangeText={(value) => updateDraft('workDate', value)} placeholder="2026-11-03" />
              {formError ? <Text style={styles.formError}>{formError}</Text> : null}
              <Pressable disabled={isSaving} onPress={submitJob} style={[styles.submitButton, isSaving && styles.submitButtonDisabled]}>
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>İlanı yayımla</Text>}
              </Pressable>
              <Text style={styles.formFootnote}>İlanın Yevmiyem İznik iş ağına eklenir; telefonun üyeler dışında gösterilmez.</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <AccountModal visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </SafeAreaView>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
};

function FormField({ label, value, onChangeText, placeholder, multiline = false, keyboardType = 'default' }: FormFieldProps) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#858585"
        style={[styles.formInput, multiline && styles.formInputMultiline]}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F3EA' },
  page: { paddingBottom: 36 },
  topShell: { backgroundColor: '#173E3B', borderBottomWidth: 1, borderBottomColor: '#214F4A' },
  topRow: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 },
  brandBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F2815B', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  brandName: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: -1.2 },
  brandTagline: { color: '#C9DFD9', fontSize: 11, marginTop: 1 },
  accountActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  loginButton: { paddingHorizontal: 12, paddingVertical: 10 },
  headerLink: { paddingHorizontal: 8, paddingVertical: 10 },
  loginText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  postAdButton: { backgroundColor: '#F2815B', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 11 },
  postAdText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  searchPanel: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  searchField: { flexGrow: 1, flexBasis: 350, height: 47, backgroundColor: '#FFFFFF', borderColor: '#DCE6E1', borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  locationField: { flexGrow: 1, flexBasis: 200, height: 47, backgroundColor: '#FFFFFF', borderColor: '#DCE6E1', borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  fieldIcon: { color: '#39746A', fontSize: 21, marginRight: 8 },
  searchInput: { flex: 1, color: '#252525', fontSize: 14, paddingVertical: 0 },
  locationInput: { flex: 1, color: '#252525', fontSize: 13, paddingVertical: 0 },
  searchButton: { minWidth: 112, height: 47, borderRadius: 13, backgroundColor: '#F2815B', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  searchButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  categoryBar: { backgroundColor: '#EAE6D9', flexDirection: 'row', alignItems: 'center', paddingLeft: 20, minHeight: 62 },
  areaBar: { backgroundColor: '#F0EDE3', flexDirection: 'row', alignItems: 'center', paddingLeft: 20, minHeight: 52 },
  areaBarLabel: { color: '#52635D', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', paddingRight: 13, letterSpacing: 0.6 },
  areaQuickList: { alignItems: 'center', gap: 7, paddingRight: 20 },
  areaQuickButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 15, backgroundColor: '#FFFEFA', borderWidth: 1, borderColor: '#D9DED6' },
  areaQuickButtonActive: { backgroundColor: '#F2815B', borderColor: '#F2815B' },
  areaQuickText: { color: '#56635F', fontSize: 11, fontWeight: '700' },
  areaQuickTextActive: { color: '#FFFFFF', fontWeight: '800' },
  categoryLabel: { color: '#52635D', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', paddingRight: 13, letterSpacing: 0.6 },
  categoryList: { alignItems: 'center', gap: 7, paddingRight: 20 },
  categoryButton: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16, backgroundColor: '#F8F7F1' },
  categoryButtonSelected: { backgroundColor: '#173E3B' },
  categoryButtonText: { color: '#56635F', fontSize: 11, fontWeight: '700' },
  categoryButtonTextSelected: { color: '#FFFFFF', fontWeight: '800' },
  content: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 20 },
  breadcrumb: { paddingTop: 17, paddingBottom: 12 },
  breadcrumbText: { color: '#7E8982', fontSize: 10 },
  welcomeBanner: { backgroundColor: '#D8E6DD', borderRadius: 22, padding: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 23, overflow: 'hidden' },
  welcomeCopy: { flex: 1, minWidth: 220 },
  welcomeEyebrow: { color: '#42776D', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  welcomeTitle: { color: '#163F3B', fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginTop: 8 },
  welcomeBody: { color: '#4E6B61', fontSize: 11, marginTop: 5 },
  locationStamp: { minWidth: 110, height: 72, borderRadius: 16, backgroundColor: '#F8F4E9', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  locationStampIcon: { color: '#F2815B', fontSize: 24 },
  locationStampText: { color: '#476057', fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginTop: 2 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, paddingBottom: 19 },
  headingCopy: { flex: 1, minWidth: 220 },
  pageTitle: { color: '#1C3F3A', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  pageSubtitle: { color: '#6E7C73', fontSize: 12, marginTop: 5 },
  smallPostButton: { backgroundColor: '#F2815B', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 10 },
  smallPostButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  toolbar: { minHeight: 48, backgroundColor: '#F9F8F3', borderRadius: 12, borderWidth: 1, borderColor: '#E4E1D7', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  resultCount: { color: '#31584F', fontSize: 12, fontWeight: '900' },
  sortGroup: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 3 },
  sortLabel: { color: '#737373', fontSize: 11, marginRight: 4 },
  sortOption: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 12 },
  sortOptionActive: { backgroundColor: '#DCEBE3' },
  sortOptionText: { color: '#69766F', fontSize: 10 },
  sortOptionTextActive: { color: '#1B5148', fontWeight: '900' },
  listingList: { gap: 11, paddingTop: 13 },
  listingCard: { backgroundColor: '#FFFEFA', borderWidth: 1, borderColor: '#E7E3D8', borderRadius: 17, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#354D44', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  listingCardCompact: { flexWrap: 'wrap', alignItems: 'flex-start', gap: 10 },
  listingPicture: { width: 112, height: 96, borderRadius: 14, backgroundColor: '#F7E3D8', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  listingPictureCompact: { width: 62, height: 58, borderRadius: 12 },
  listingEmoji: { fontSize: 31 },
  pictureCaption: { color: '#A25D45', fontSize: 8, fontWeight: '900', marginTop: 5, textTransform: 'uppercase' },
  listingMain: { flex: 1, minWidth: 0, alignSelf: 'stretch', justifyContent: 'center', paddingVertical: 2 },
  listingMainCompact: { flexBasis: '75%', minWidth: 180 },
  listingTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  listingTitle: { color: '#1E4F49', fontSize: 15, fontWeight: '900', flexShrink: 1 },
  demoBadge: { backgroundColor: '#F6E4D6', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  demoBadgeText: { color: '#A75A3F', fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  listingDescription: { color: '#596A62', fontSize: 11, lineHeight: 16, marginTop: 6 },
  listingMeta: { color: '#6D7A72', fontSize: 10, marginTop: 7 },
  employerName: { color: '#435C53', fontSize: 10, fontWeight: '800', marginTop: 4 },
  priceColumn: { minWidth: 135, alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0, paddingVertical: 12, paddingHorizontal: 13, backgroundColor: '#EAF1E6', borderRadius: 13 },
  priceColumnCompact: { width: '100%', flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-start', gap: 7, paddingLeft: 72, paddingTop: 9 },
  priceValue: { color: '#1C4A42', fontSize: 17, fontWeight: '900' },
  priceUnit: { color: '#6B7A70', fontSize: 9, marginTop: 3 },
  detailLink: { color: '#E27653', fontSize: 10, fontWeight: '900', marginTop: 10 },
  loadingBox: { backgroundColor: '#FFFEFA', minHeight: 170, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderWidth: 1, borderColor: '#E7E3D8', borderRadius: 17 },
  loadingText: { color: '#62746A', fontSize: 12, marginTop: 10 },
  errorBox: { marginTop: 10, backgroundColor: '#FFF7F3', borderWidth: 1, borderColor: '#F0CABC', borderRadius: 16, padding: 18 },
  errorTitle: { color: '#8B3B2D', fontWeight: '900', fontSize: 15 },
  errorText: { color: '#745850', fontSize: 12, lineHeight: 18, marginTop: 6 },
  retryButton: { alignSelf: 'flex-start', marginTop: 13, backgroundColor: '#173E3B', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 },
  retryButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  emptyBox: { backgroundColor: '#FFFEFA', borderWidth: 1, borderColor: '#E7E3D8', borderRadius: 17, alignItems: 'center', padding: 28, marginTop: 10 },
  emptyIcon: { fontSize: 31, color: '#F2815B' },
  emptyTitle: { color: '#24463F', fontSize: 15, fontWeight: '900', marginTop: 8 },
  emptyText: { color: '#718077', fontSize: 12, textAlign: 'center', marginTop: 5 },
  successBanner: { backgroundColor: '#E3F0E6', borderColor: '#C5DCCB', borderWidth: 1, borderRadius: 11, padding: 11, marginTop: 10 },
  successText: { color: '#315C4E', fontSize: 12, fontWeight: '800' },
  footerNote: { color: '#849087', fontSize: 10, textAlign: 'center', marginTop: 25 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20,20,20,0.55)', padding: 16, alignItems: 'center', justifyContent: 'center' },
  formCard: { width: '100%', maxWidth: 560, maxHeight: '92%', backgroundColor: '#FFFEFA', borderRadius: 20, padding: 18 },
  formHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E6E1D7' },
  formTitle: { color: '#1D4842', fontSize: 18, fontWeight: '900' },
  formSubtitle: { color: '#748078', fontSize: 11, marginTop: 4 },
  closeButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAEDE5' },
  closeButtonText: { color: '#31574F', fontSize: 23, lineHeight: 26 },
  formScroll: { marginTop: 10 },
  formField: { marginTop: 9 },
  formLabel: { color: '#465B52', fontSize: 11, fontWeight: '900', marginBottom: 5 },
  formHint: { color: '#819087', fontSize: 10, marginTop: 5, marginBottom: 7 },
  formInput: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: '#D9DED6', backgroundColor: '#FFFFFF', paddingHorizontal: 10, color: '#253D35', fontSize: 12 },
  formInputMultiline: { height: 78, paddingTop: 9 },
  formCategoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  formCategory: { paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1, borderColor: '#D9DED6', borderRadius: 10, backgroundColor: '#FFFFFF' },
  formCategoryActive: { backgroundColor: '#DCEBE3', borderColor: '#75A297' },
  formCategoryText: { color: '#647168', fontSize: 10, fontWeight: '700' },
  formCategoryTextActive: { color: '#214F47' },
  formTwoColumns: { flexDirection: 'row', gap: 10 },
  formHalf: { flex: 1 },
  formError: { color: '#A32727', fontSize: 11, marginTop: 10, lineHeight: 16 },
  submitButton: { minHeight: 44, backgroundColor: '#173E3B', alignItems: 'center', justifyContent: 'center', borderRadius: 11, marginTop: 14, paddingHorizontal: 14 },
  submitButtonDisabled: { opacity: 0.65 },
  submitButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  formFootnote: { color: '#819087', fontSize: 9, lineHeight: 14, marginTop: 10, textAlign: 'center' },
  detailCard: { width: '100%', maxWidth: 560, backgroundColor: '#FFFEFA', borderRadius: 20, padding: 19 },
  detailHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailIcon: { width: 46, height: 46, backgroundColor: '#F7E3D8', borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  detailEmoji: { fontSize: 24 },
  detailHeadingCopy: { flex: 1 },
  detailTitle: { color: '#1E4F49', fontSize: 16, fontWeight: '900' },
  detailArea: { color: '#737373', fontSize: 11, marginTop: 4 },
  detailPay: { color: '#1E4F49', fontSize: 24, fontWeight: '900', marginTop: 18 },
  detailPayUnit: { color: '#777777', fontSize: 12, fontWeight: '500' },
  detailDescription: { color: '#4D4D4D', fontSize: 13, lineHeight: 21, marginTop: 13 },
  detailRule: { height: 1, backgroundColor: '#E5E5E5', marginVertical: 14 },
  detailMeta: { color: '#5E5E5E', fontSize: 12, marginTop: 7 },
  detailNote: { color: '#787878', fontSize: 10, lineHeight: 15, marginTop: 15 },
});
