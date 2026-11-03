import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import AccountModal from '../components/AccountModal';
import { apiUrl, useAuth } from '../auth/AuthProvider';

type Notice = { id: number; type: string; title: string; body: string; jobId?: number | null; applicationId?: number | null; createdAt: string; readAt?: string | null };
export default function NotificationsScreen() {
  const router = useRouter(); const { token, ready } = useAuth();
  const [items, setItems] = useState<Notice[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [accountOpen, setAccountOpen] = useState(false);
  const headers = useMemo<Record<string, string>>(() => token ? { Authorization: `Bearer ${token}` } as Record<string, string> : {}, [token]);
  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true); setError('');
    try { const response = await fetch(apiUrl('/notifications'), { headers }); if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.detail || `Bildirimler yüklenemedi (${response.status}).`); } setItems(await response.json()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Bildirimler yüklenemedi.'); }
    finally { setLoading(false); }
  }, [headers, token]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  const markAll = async () => { if (!token) return; const response = await fetch(apiUrl('/notifications/read-all'), { method: 'POST', headers }); if (response.ok) await load(); };
  const open = async (item: Notice) => {
    if (token && !item.readAt) { await fetch(apiUrl(`/notifications/${item.id}/read`), { method: 'PATCH', headers }); setItems(current => current.map(n => n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)); }
    if (item.jobId) {
      if (item.type === 'chat_message' && item.applicationId) router.push({ pathname: '/jobs/[id]/chat', params: { id: String(item.jobId), applicationId: String(item.applicationId) } });
      else router.push({ pathname: '/jobs/[id]', params: { id: String(item.jobId) } });
    }
  };
  if (!ready || loading) return <SafeAreaView style={s.safe}><ActivityIndicator style={{ marginTop: 80 }} color="#173E3B" /></SafeAreaView>;
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.page}>
    <Pressable onPress={() => router.back()}><Text style={s.back}>‹  Geri dön</Text></Pressable>
    <View style={s.heading}><View><Text style={s.title}>Bildirimler</Text><Text style={s.subtitle}>İlan eşleşmeleri, başvuru yanıtları ve sohbet mesajları.</Text></View>{token ? <Pressable onPress={markAll}><Text style={s.mark}>Tümünü okundu yap</Text></Pressable> : null}</View>
    {!token ? <View style={s.empty}><Text style={s.body}>Bildirimlerini görmek için giriş yap.</Text><Pressable style={s.button} onPress={() => setAccountOpen(true)}><Text style={s.buttonText}>Giriş yap / kayıt ol</Text></Pressable></View> : error ? <Text style={s.error}>{error}</Text> : items.length ? items.map(item => <Pressable key={item.id} onPress={() => void open(item)} style={[s.card, !item.readAt && s.unread]}><View style={s.row}><Text style={s.cardTitle}>{item.title}</Text>{!item.readAt ? <View style={s.dot} /> : null}</View><Text style={s.body}>{item.body}</Text><Text style={s.date}>{new Date(item.createdAt).toLocaleString('tr-TR')}</Text></Pressable>) : <View style={s.empty}><Text style={s.emptyTitle}>Henüz bildirimin yok</Text><Text style={s.body}>Favori bölgelerine uygun bir ilan veya yeni bir yanıt geldiğinde burada göreceksin.</Text><Pressable style={s.button} onPress={() => router.push('/preferences')}><Text style={s.buttonText}>İş tercihlerini belirle</Text></Pressable></View>}
  </ScrollView><AccountModal visible={accountOpen} onClose={() => setAccountOpen(false)} /></SafeAreaView>;
}
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#F5F3EA' }, page: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 48 }, back: { color: '#42776D', fontWeight: '800', paddingVertical: 8 }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 12, marginBottom: 18 }, title: { color: '#173E3B', fontSize: 28, fontWeight: '900' }, subtitle: { color: '#718077', marginTop: 5 }, mark: { color: '#42776D', fontWeight: '800', fontSize: 12 }, card: { backgroundColor: '#FFFEFA', borderRadius: 15, padding: 17, borderWidth: 1, borderColor: '#E7E3D8', marginBottom: 9 }, unread: { borderColor: '#75A297', backgroundColor: '#F2F8F3' }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, cardTitle: { color: '#1C3F3A', fontSize: 15, fontWeight: '900', flex: 1 }, dot: { width: 9, height: 9, backgroundColor: '#F2815B', borderRadius: 5, marginLeft: 10 }, body: { color: '#596A62', lineHeight: 20, marginTop: 7 }, date: { color: '#849087', fontSize: 11, marginTop: 10 }, empty: { backgroundColor: '#FFFEFA', padding: 24, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E7E3D8' }, emptyTitle: { color: '#1C3F3A', fontSize: 17, fontWeight: '900' }, button: { minHeight: 44, borderRadius: 11, backgroundColor: '#173E3B', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, marginTop: 15 }, buttonText: { color: '#fff', fontWeight: '800' }, error: { color: '#A32727' } });
