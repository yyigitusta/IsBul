import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import AccountModal from '../components/AccountModal';
import { apiUrl, useAuth } from '../auth/AuthProvider';

const FALLBACK_AREAS = ['İznik merkez', 'Boyalıca', 'Elbeyli'];
const FALLBACK_CATEGORIES = ['Tarım', 'Taşıma', 'Bahçe', 'Temizlik', 'İnşaat', 'Diğer'];
type Preferences = { areas: string[]; categories: string[]; newJobAlertsEnabled: boolean; applicationAlertsEnabled: boolean; messageAlertsEnabled: boolean };
const EMPTY: Preferences = { areas: [], categories: [], newJobAlertsEnabled: true, applicationAlertsEnabled: true, messageAlertsEnabled: true };

export default function PreferencesScreen() {
  const router = useRouter(); const { token, ready } = useAuth();
  const [areas, setAreas] = useState(FALLBACK_AREAS); const [categories, setCategories] = useState(FALLBACK_CATEGORIES); const [value, setValue] = useState(EMPTY);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [accountOpen, setAccountOpen] = useState(false);
  const headers = useMemo<Record<string, string>>(() => token ? { Authorization: `Bearer ${token}` } as Record<string, string> : {}, [token]);
  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [preferencesResponse, areasResponse, categoriesResponse] = await Promise.all([
        fetch(apiUrl('/me/preferences'), { headers }), fetch(apiUrl('/jobs/areas')), fetch(apiUrl('/jobs/categories')),
      ]);
      if (!preferencesResponse.ok) throw new Error('Tercihler alınamadı.');
      setValue(await preferencesResponse.json());
      if (areasResponse.ok) setAreas(await areasResponse.json());
      if (categoriesResponse.ok) setCategories(await categoriesResponse.json());
    } catch (e) { setError(e instanceof Error ? e.message : 'Tercihler alınamadı.'); }
    finally { setLoading(false); }
  }, [headers, token]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  const toggleValue = (key: 'areas' | 'categories', option: string) => setValue(current => {
    const items = current[key].includes(option) ? current[key].filter(item => item !== option) : [...current[key], option];
    return { ...current, [key]: items };
  });
  const save = async () => {
    if (!token) { setAccountOpen(true); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(apiUrl('/me/preferences'), { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.detail || 'Tercihler kaydedilemedi.');
      setValue(body); setNotice('Tercihlerin kaydedildi.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Tercihler kaydedilemedi.'); }
    finally { setSaving(false); }
  };
  if (!ready || loading) return <SafeAreaView style={s.safe}><ActivityIndicator style={{ marginTop: 80 }} color="#173E3B" /></SafeAreaView>;
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.page}>
    <Pressable onPress={() => router.back()}><Text style={s.back}>‹  Geri dön</Text></Pressable>
    <Text style={s.title}>İş tercihlerin</Text><Text style={s.subtitle}>Favori bölgelerini ve iş türlerini seç. Eşleşen ilanlar için bildirim oluşturalım.</Text>
    {!token ? <View style={s.card}><Text style={s.body}>Tercihlerini kaydetmek için giriş yap.</Text><Pressable style={s.save} onPress={() => setAccountOpen(true)}><Text style={s.saveText}>Giriş yap / kayıt ol</Text></Pressable></View> : <>
      <View style={s.card}><Text style={s.heading}>Bölgeler</Text><Text style={s.help}>Birden fazla seçebilirsin.</Text><View style={s.chips}>{areas.map(area => <Chip key={area} selected={value.areas.includes(area)} label={area} onPress={() => toggleValue('areas', area)} />)}</View></View>
      <View style={s.card}><Text style={s.heading}>İş türleri</Text><Text style={s.help}>Birden fazla seçebilirsin.</Text><View style={s.chips}>{categories.map(category => <Chip key={category} selected={value.categories.includes(category)} label={category} onPress={() => toggleValue('categories', category)} />)}</View></View>
      <View style={s.card}><Text style={s.heading}>Bildirimler</Text><Text style={s.help}>Uygulama içi bildirim kutusu web ve mobilde çalışır. Telefonuna anlık bildirim için Expo/EAS ile derlenmiş mobil uygulama gerekir.</Text><PreferenceSwitch label="Favorilerime uyan yeni ilanlar" value={value.newJobAlertsEnabled} onValueChange={enabled => setValue(v => ({ ...v, newJobAlertsEnabled: enabled }))} /><PreferenceSwitch label="Başvuru durumuma yanıt" value={value.applicationAlertsEnabled} onValueChange={enabled => setValue(v => ({ ...v, applicationAlertsEnabled: enabled }))} /><PreferenceSwitch label="Sohbette yeni mesaj" value={value.messageAlertsEnabled} onValueChange={enabled => setValue(v => ({ ...v, messageAlertsEnabled: enabled }))} /></View>
      {error ? <Text style={s.error}>{error}</Text> : null}{notice ? <Text style={s.notice}>{notice}</Text> : null}
      <Pressable disabled={saving} style={s.save} onPress={save}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Tercihleri kaydet</Text>}</Pressable>
    </>}
  </ScrollView><AccountModal visible={accountOpen} onClose={() => setAccountOpen(false)} /></SafeAreaView>;
}
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[s.chip, selected && s.chipOn]}><Text style={[s.chipText, selected && s.chipTextOn]}>{selected ? '✓  ' : ''}{label}</Text></Pressable>; }
function PreferenceSwitch({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) { return <View style={s.switchRow}><Text style={s.switchLabel}>{label}</Text><Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#D5D8D2', true: '#78A69A' }} thumbColor={value ? '#173E3B' : '#F5F5F5'} /></View>; }
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#F5F3EA' }, page: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 48 }, back: { color: '#42776D', fontWeight: '800', paddingVertical: 8 }, title: { color: '#173E3B', fontSize: 28, fontWeight: '900', marginTop: 16 }, subtitle: { color: '#718077', lineHeight: 21, marginTop: 7, marginBottom: 17 }, card: { backgroundColor: '#FFFEFA', borderRadius: 17, padding: 18, borderWidth: 1, borderColor: '#E7E3D8', marginBottom: 12 }, heading: { color: '#1C3F3A', fontSize: 17, fontWeight: '900' }, help: { color: '#718077', fontSize: 12, marginTop: 5, marginBottom: 12 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderRadius: 15, borderWidth: 1, borderColor: '#D9DED6', paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fff' }, chipOn: { backgroundColor: '#DCEBE3', borderColor: '#75A297' }, chipText: { color: '#56635F', fontWeight: '700', fontSize: 12 }, chipTextOn: { color: '#214F47' }, switchRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: '#ECE9DF', marginTop: 8, paddingTop: 8, gap: 12 }, switchLabel: { color: '#465B52', fontWeight: '700', flex: 1 }, save: { minHeight: 48, borderRadius: 12, backgroundColor: '#173E3B', alignItems: 'center', justifyContent: 'center', marginTop: 12 }, saveText: { color: '#fff', fontWeight: '900' }, body: { color: '#718077' }, error: { color: '#A32727', marginTop: 10 }, notice: { color: '#315C4E', backgroundColor: '#E3F0E6', padding: 11, borderRadius: 10, marginTop: 8 } });
