import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';

export default function AccountModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { signIn } = useAuth(); const [register, setRegister] = useState(true); const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setError(''); try { await signIn(phone, password, register ? { name } : undefined); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'İşlem başarısız.'); } finally { setBusy(false); } };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}><View style={styles.card}><View style={styles.heading}><View><Text style={styles.title}>{register ? 'Hesap oluştur' : 'Giriş yap'}</Text><Text style={styles.sub}>İş ara ve ilan ver; aynı hesapla.</Text></View><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled">
        {register && <Field label="Ad soyad" value={name} onChangeText={setName} placeholder="Adın soyadın" />}
        <Field label="Telefon" value={phone} onChangeText={setPhone} placeholder="05xx xxx xx xx" keyboardType="phone-pad" />
        <Field label="Şifre" value={password} onChangeText={setPassword} placeholder="En az 8 karakter" secureTextEntry />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable disabled={busy} style={styles.button} onPress={submit}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{register ? 'Ücretsiz hesap oluştur' : 'Giriş yap'}</Text>}</Pressable>
        <Pressable style={styles.switch} onPress={() => { setRegister(!register); setError(''); }}><Text style={styles.switchText}>{register ? 'Zaten hesabın var mı? Giriş yap' : 'Yeni misin? Hesap oluştur'}</Text></Pressable>
      </ScrollView></View></View></Modal>;
}
function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', secureTextEntry = false }: { label: string; value: string; onChangeText: (v: string) => void; placeholder: string; keyboardType?: 'default' | 'phone-pad'; secureTextEntry?: boolean }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} keyboardType={keyboardType} secureTextEntry={secureTextEntry} style={styles.input} autoCapitalize="none" /></View>; }
const styles = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: 'rgba(13,35,31,.62)', justifyContent: 'center', alignItems: 'center', padding: 18 }, card: { width: '100%', maxWidth: 440, borderRadius: 22, backgroundColor: '#FFFEFA', padding: 22 }, heading: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }, title: { color: '#173E3B', fontSize: 22, fontWeight: '900' }, sub: { color: '#718077', marginTop: 4 }, close: { color: '#31574F', fontSize: 28 }, field: { marginTop: 10 }, label: { color: '#465B52', fontSize: 12, fontWeight: '800', marginBottom: 5 }, input: { height: 46, borderWidth: 1, borderColor: '#D9DED6', borderRadius: 11, paddingHorizontal: 12, color: '#253D35', backgroundColor: '#fff' }, error: { color: '#A32727', marginTop: 10 }, button: { height: 48, borderRadius: 12, marginTop: 16, backgroundColor: '#173E3B', alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#fff', fontWeight: '800' }, switch: { padding: 12, alignItems: 'center' }, switchText: { color: '#42776D', fontWeight: '700' } });
