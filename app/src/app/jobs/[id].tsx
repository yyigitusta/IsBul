import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiUrl, useAuth } from '../../auth/AuthProvider';
import AccountModal from '../../components/AccountModal';

type Job = { id: number; title: string; description: string; area: string; category: string; dailyPayTry: number; workerCount: number; workDate: string; employerName: string; createdAt: string; isDemo: boolean; status: 'open' | 'filled' | 'cancelled' };
type Application = { id: number; jobId: number; applicantName: string; experience: string; message: string; status: string };
type JobDraft = Pick<Job, 'title' | 'description' | 'area' | 'category' | 'dailyPayTry' | 'workerCount' | 'workDate'>;
const money = (value: number) => new Intl.NumberFormat('tr-TR').format(value);

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, user, ready } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [phone, setPhone] = useState('');
  const [mine, setMine] = useState<Application | null>(null);
  const [incoming, setIncoming] = useState<Application[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [experience, setExperience] = useState('');
  const [message, setMessage] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [jobDraft, setJobDraft] = useState<JobDraft | null>(null);
  const [savingJob, setSavingJob] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [sendingReport, setSendingReport] = useState(false);
  const headers = useMemo<Record<string, string>>(() => token ? { Authorization: `Bearer ${token}` } as Record<string, string> : {}, [token]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(apiUrl(`/jobs/${id}`));
      if (!response.ok) throw new Error('İlan bulunamadı.');
      const loadedJob = await response.json() as Job;
      setJob(loadedJob);
      setJobDraft({ title: loadedJob.title, description: loadedJob.description, area: loadedJob.area, category: loadedJob.category, dailyPayTry: loadedJob.dailyPayTry, workerCount: loadedJob.workerCount, workDate: loadedJob.workDate.slice(0, 10) });
      if (token && user) {
        const [applicationsResponse, membershipResponse, contactResponse] = await Promise.all([
          fetch(apiUrl(`/jobs/${id}/applications`), { headers }),
          fetch(apiUrl(`/jobs/${id}/membership`), { headers }),
          fetch(apiUrl(`/jobs/${id}/contact`), { headers }),
        ]);
        setIncoming(applicationsResponse.ok ? await applicationsResponse.json() : []);
        if (membershipResponse.ok) {
          const membership = await membershipResponse.json();
          setMine(membership.application);
          setIsOwner(membership.isOwner);
        } else {
          setMine(null);
          setIsOwner(false);
        }
        if (contactResponse.ok) setPhone((await contactResponse.json()).phone);
        else setPhone('');
      } else {
        setIncoming([]); setMine(null); setIsOwner(false); setPhone('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İlan yüklenemedi.');
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [headers, id, token, user]);

  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);

  const apply = async () => {
    if (!ready) return;
    if (!token) { setAccountOpen(true); return; }
    setError('');
    try {
      const response = await fetch(apiUrl(`/jobs/${id}/applications`), {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ experience, message }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.detail || 'Başvuru gönderilemedi.');
      setNotice('Başvurun işverene iletildi.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Başvuru gönderilemedi.'); }
  };

  const updateApplicationStatus = async (applicationId: number, status: 'accepted' | 'declined') => {
    const response = await fetch(apiUrl(`/jobs/${id}/applications/${applicationId}`), {
      method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    if (response.ok) await load();
    else setError('Başvuru durumu güncellenemedi.');
  };

  const updateJobStatus = async (status: Job['status']) => {
    setError('');
    try {
      const response = await fetch(apiUrl(`/jobs/${id}/status`), {
        method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.detail || `İlan durumu güncellenemedi (${response.status}).`);
      setNotice('İlan durumu güncellendi.');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'İlan durumu güncellenemedi.'); }
  };

  const saveJob = async () => {
    if (!jobDraft) return;
    setSavingJob(true); setError(''); setNotice('');
    try {
      const response = await fetch(apiUrl(`/jobs/${id}`), { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(jobDraft) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.detail || 'İlan düzenlenemedi.');
      setJob(body); setEditing(false); setNotice('İlan bilgileri güncellendi.');
    } catch (e) { setError(e instanceof Error ? e.message : 'İlan düzenlenemedi.'); }
    finally { setSavingJob(false); }
  };

  const sendReport = async () => {
    if (!reportReason.trim()) { setError('Lütfen bildirim nedenini yaz.'); return; }
    setSendingReport(true); setError('');
    try {
      const response = await fetch(apiUrl('/reports'), { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job?.id, reason: reportReason, details: reportDetails }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.detail || 'Bildirim gönderilemedi.');
      setReporting(false); setReportReason(''); setReportDetails(''); setNotice('Bildirimin alındı ve inceleme için kaydedildi.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Bildirim gönderilemedi.'); }
    finally { setSendingReport(false); }
  };

  const updateDraft = (key: keyof JobDraft, value: string) => setJobDraft(current => current ? { ...current, [key]: key === 'dailyPayTry' || key === 'workerCount' ? Number(value) : value } as JobDraft : current);

  if (loading) return <SafeAreaView style={s.safe}><ActivityIndicator style={{ marginTop: 80 }} color="#173E3B" /></SafeAreaView>;
  if (!job) return <SafeAreaView style={s.safe}><Text style={s.error}>{error || 'İlan bulunamadı.'}</Text><Pressable onPress={() => router.back()}><Text style={s.link}>Geri dön</Text></Pressable></SafeAreaView>;

  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.page}>
    <Pressable style={s.back} onPress={() => router.back()}><Text style={s.link}>‹  İlanlara dön</Text></Pressable>
    <View style={s.hero}>
      <Text style={s.tag}>{job.category} · {job.area} · {job.status === 'open' ? 'Açık' : job.status === 'filled' ? 'Dolduruldu' : 'İptal edildi'}</Text>
      <Text style={s.title}>{job.title}</Text>
      <Text style={s.price}>{money(job.dailyPayTry)} ₺ <Text style={s.unit}>/ gün</Text></Text>
    </View>
    <View style={s.card}>
      <Text style={s.h2}>İş hakkında</Text><Text style={s.body}>{job.description}</Text><View style={s.line} />
      <Text style={s.meta}>Çalışma tarihi: {new Date(`${job.workDate.slice(0, 10)}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
      <Text style={s.meta}>Aranan kişi: {job.workerCount}</Text><Text style={s.meta}>İşveren: {job.employerName}</Text>
      <Text style={s.meta}>İlan tarihi: {new Date(job.createdAt).toLocaleDateString('tr-TR')}</Text>
    </View>
    {error ? <Text style={s.error}>{error}</Text> : null}{notice ? <Text style={s.notice}>{notice}</Text> : null}
    {token ? <Pressable style={s.secondary} onPress={() => phone ? Linking.openURL(`tel:${phone}`) : setError('İşveren telefon numarasını paylaşmamış.')}><Text style={s.secondaryText}>☎  İşvereni ara {phone ? `· ${phone}` : ''}</Text></Pressable> : <Pressable style={s.secondary} onPress={() => setAccountOpen(true)}><Text style={s.secondaryText}>İşveren iletişimi için giriş yap</Text></Pressable>}

    {isOwner ? <View style={s.card}>
      <Text style={s.h2}>İlan durumu</Text><View style={s.actions}>
        {job.status !== 'open' ? <Pressable style={s.accept} onPress={() => void updateJobStatus('open')}><Text style={s.actionText}>Yeniden aç</Text></Pressable> : null}
        {job.status !== 'filled' ? <Pressable style={s.accept} onPress={() => void updateJobStatus('filled')}><Text style={s.actionText}>Dolduruldu</Text></Pressable> : null}
        {job.status !== 'cancelled' ? <Pressable style={s.decline} onPress={() => void updateJobStatus('cancelled')}><Text style={s.actionText}>İptal et</Text></Pressable> : null}
      </View>
      <Pressable style={s.secondary} onPress={() => setEditing(value => !value)}><Text style={s.secondaryText}>{editing ? 'Düzenlemeyi kapat' : 'İlan bilgilerini düzenle'}</Text></Pressable>
      {editing && jobDraft ? <View>
        <Text style={s.label}>İlan başlığı</Text><TextInput value={jobDraft.title} onChangeText={value => updateDraft('title', value)} style={s.input} />
        <Text style={s.label}>Açıklama</Text><TextInput value={jobDraft.description} onChangeText={value => updateDraft('description', value)} style={[s.input, s.multiline]} multiline />
        <Text style={s.label}>Konum</Text><TextInput value={jobDraft.area} onChangeText={value => updateDraft('area', value)} style={s.input} />
        <Text style={s.label}>Kategori</Text><TextInput value={jobDraft.category} onChangeText={value => updateDraft('category', value)} style={s.input} />
        <Text style={s.label}>Yevmiye (TL)</Text><TextInput value={String(jobDraft.dailyPayTry)} onChangeText={value => updateDraft('dailyPayTry', value)} style={s.input} keyboardType="numeric" />
        <Text style={s.label}>Çalışan sayısı</Text><TextInput value={String(jobDraft.workerCount)} onChangeText={value => updateDraft('workerCount', value)} style={s.input} keyboardType="numeric" />
        <Text style={s.label}>Çalışma tarihi (YYYY-AA-GG)</Text><TextInput value={String(jobDraft.workDate)} onChangeText={value => updateDraft('workDate', value)} style={s.input} />
        <Pressable disabled={savingJob} style={s.primary} onPress={() => void saveJob()}><Text style={s.actionText}>{savingJob ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}</Text></Pressable>
      </View> : null}
    </View> : null}

    {!isOwner && token && !job.isDemo ? <View style={s.card}>
      {!reporting ? <Pressable onPress={() => setReporting(true)}><Text style={s.reportLink}>İlanı veya işvereni bildir</Text></Pressable> : <>
        <Text style={s.h2}>Bildirim gönder</Text><Text style={s.label}>Neden bildiriyorsun?</Text>
        <TextInput value={reportReason} onChangeText={setReportReason} style={s.input} placeholder="Örn. yanıltıcı bilgi, uygunsuz içerik" maxLength={60} />
        <Text style={s.label}>Açıklama (isteğe bağlı)</Text><TextInput value={reportDetails} onChangeText={setReportDetails} style={[s.input, s.multiline]} multiline maxLength={1000} placeholder="İncelememize yardımcı olacak ayrıntı" />
        <View style={s.actions}><Pressable disabled={sendingReport} style={s.decline} onPress={() => void sendReport()}><Text style={s.actionText}>{sendingReport ? 'Gönderiliyor…' : 'Bildirimi gönder'}</Text></Pressable><Pressable style={s.accept} onPress={() => setReporting(false)}><Text style={s.actionText}>Vazgeç</Text></Pressable></View>
      </>}
    </View> : null}

    {isOwner ? <View style={s.card}>
      <Text style={s.h2}>Başvurular</Text>
      {incoming.length === 0 ? <Text style={s.meta}>Henüz başvuru yok.</Text> : incoming.map(application => <View key={application.id} style={s.appRow}>
        <Text style={s.appName}>{application.applicantName} · {application.status}</Text>
        <Text style={s.meta}>{application.experience || 'Deneyim bilgisi eklenmedi'}</Text><Text style={s.body}>{application.message}</Text>
        {application.status === 'pending' ? <View style={s.actions}><Pressable style={s.accept} onPress={() => void updateApplicationStatus(application.id, 'accepted')}><Text style={s.actionText}>Kabul et</Text></Pressable><Pressable style={s.decline} onPress={() => void updateApplicationStatus(application.id, 'declined')}><Text style={s.actionText}>Reddet</Text></Pressable></View> : null}
        {application.status === 'accepted' ? <Pressable style={s.chat} onPress={() => router.push({ pathname: '/jobs/[id]/chat', params: { id, applicationId: String(application.id) } })}><Text style={s.actionText}>Sohbeti aç</Text></Pressable> : null}
      </View>)}
    </View> : mine ? <View style={s.card}>
      <Text style={s.h2}>Başvuru durumun: {mine.status === 'accepted' ? 'Kabul edildi' : mine.status === 'declined' ? 'Reddedildi' : 'Yanıt bekleniyor'}</Text>
      {mine.status === 'accepted' ? <Pressable style={s.chat} onPress={() => router.push({ pathname: '/jobs/[id]/chat', params: { id, applicationId: String(mine.id) } })}><Text style={s.actionText}>İşverenle sohbet et</Text></Pressable> : null}
    </View> : job.isDemo ? <View style={s.card}><Text style={s.h2}>Örnek ilan</Text><Text style={s.meta}>Bu örnek ilan yalnızca arayüzü göstermek için var; başvuru alınmıyor.</Text></View> : job.status !== 'open' ? <View style={s.card}><Text style={s.h2}>Bu ilan başvuruya kapalı</Text><Text style={s.meta}>İşveren başvuruları durdurdu.</Text></View> : <View style={s.card}>
      <Text style={s.h2}>Bu işe başvur</Text><Text style={s.meta}>Aynı hesabınla başvurabilir ve iş ilanı da verebilirsin.</Text>
      <Text style={s.label}>Deneyim ve becerilerin (isteğe bağlı)</Text><TextInput value={experience} onChangeText={setExperience} style={s.input} placeholder="Örn. Hasat işinde deneyimliyim" />
      <Text style={s.label}>İşverene mesajın</Text><TextInput value={message} onChangeText={setMessage} style={[s.input, s.multiline]} multiline placeholder="Bu işe neden uygun olduğunu anlat" />
      <Pressable style={s.primary} onPress={() => void apply()}><Text style={s.actionText}>{token ? 'Başvuruyu gönder' : 'Giriş yap ve başvur'}</Text></Pressable>
    </View>}
  </ScrollView><AccountModal visible={accountOpen} onClose={() => setAccountOpen(false)} /></SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F3EA' }, page: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 20, paddingBottom: 50 }, back: { marginBottom: 18 }, link: { color: '#42776D', fontWeight: '800', fontSize: 15 },
  hero: { borderRadius: 22, backgroundColor: '#173E3B', padding: 24, marginBottom: 14 }, tag: { color: '#B8D1C7', fontSize: 13, fontWeight: '700' }, title: { color: '#fff', fontSize: 28, lineHeight: 35, fontWeight: '900', marginTop: 10 }, price: { color: '#FF9A76', fontSize: 28, fontWeight: '900', marginTop: 18 }, unit: { color: '#E1ECE5', fontSize: 15, fontWeight: '500' },
  card: { backgroundColor: '#FFFEFA', borderRadius: 18, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#E7E3D8' }, h2: { color: '#1C3F3A', fontSize: 18, fontWeight: '900', marginBottom: 10 }, body: { color: '#4D5E55', fontSize: 14, lineHeight: 22 }, line: { height: 1, backgroundColor: '#E5E5E5', marginVertical: 13 }, meta: { color: '#718077', fontSize: 13, marginTop: 7 },
  secondary: { minHeight: 48, backgroundColor: '#DCEBE3', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, secondaryText: { color: '#214F47', fontWeight: '800' }, reportLink: { color: '#A95347', fontWeight: '800', textAlign: 'center', padding: 9 }, label: { color: '#465B52', fontWeight: '800', marginTop: 12, marginBottom: 6 }, input: { borderWidth: 1, borderColor: '#D9DED6', backgroundColor: '#fff', padding: 12, borderRadius: 10, color: '#253D35' }, multiline: { height: 92, textAlignVertical: 'top' }, primary: { minHeight: 48, backgroundColor: '#F2815B', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, actionText: { color: '#fff', fontWeight: '800' }, error: { color: '#A32727', marginBottom: 10 }, notice: { backgroundColor: '#E3F0E6', color: '#315C4E', padding: 12, borderRadius: 10, marginBottom: 10 }, appRow: { borderTopWidth: 1, borderColor: '#E5E5E5', paddingTop: 12, marginTop: 12 }, appName: { color: '#1C3F3A', fontWeight: '900' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }, accept: { backgroundColor: '#39746A', borderRadius: 8, padding: 10 }, decline: { backgroundColor: '#A95347', borderRadius: 8, padding: 10 }, chat: { backgroundColor: '#173E3B', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 10 },
});
