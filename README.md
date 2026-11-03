# Yevmiyem — İznik günlük iş ilanları

İş arayanlarla günlük işçi arayan işverenleri İznik'te buluşturan web ve mobil uygulama başlangıcı.

## Proje yapısı

- `app/`: Expo + React Native arayüzü (Android, iOS ve web)
- `api/`: ASP.NET Core 8 Web API
- `api/App_Data/jobs.json`: geliştirme API'sinin kalıcı ilan dosyası

## Çalıştırma

API'yi bir terminalde başlat:

```powershell
cd api
dotnet run --launch-profile http
```

Expo arayüzünü başka bir terminalde başlat:

```powershell
cd app
npm install
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-secure-store
npx expo install react-dom react-native-web
npm run web
```

Web arayüzü varsayılan olarak API'yi `http://localhost:5160/api` adresinde arar. Farklı bir adres kullanıyorsan `app/.env.example` dosyasını `app/.env.local` adıyla kopyalayıp `EXPO_PUBLIC_API_URL` değerini güncelle. Fiziksel telefonda `localhost` yerine bilgisayarının yerel ağ adresini kullan.

## API

- `GET /api/jobs`: arama, kategori, alan, yevmiye aralığı, iş tarihi, sıralama ve sayfalama. Yanıt gövdesi ilan dizisi olarak kalır; toplam ve sayfa bilgileri `X-Total-Count`, `X-Page` ve `X-Page-Size` başlıklarındadır.
- `GET /api/jobs/categories`: ilan kategorileri.
- `GET /api/jobs/areas`: favori konumlarda kullanılabilen bölgeler.
- `GET /api/jobs/{id}`: tek ilan.
- `PATCH /api/jobs/{id}/status`: ilan sahibi ilanı `open`, `filled` veya `cancelled` durumuna alır.
- `PUT /api/jobs/{id}`: ilan sahibi ilan ayrıntılarını günceller.
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`: telefon ve şifre ile üyelik/giriş. Korumalı uç noktalar `Authorization: Bearer <token>` ister.
- `POST /api/jobs`: oturum açmış üyenin ilanı. Her hesap hem ilan verebilir hem başka ilana başvurabilir.
- `POST /api/jobs/{id}/applications`: oturum açmış üyenin başvurusu; aynı ilana ikinci başvuru ve kendi ilanına başvuru engellenir.
- `GET /api/jobs/{id}/applications`: yalnızca ilan sahibinin başvuruları görmesi.
- `PATCH /api/jobs/{id}/applications/{applicationId}`: ilan sahibinin başvuruyu `accepted` veya `declined` yapması.
- `GET /api/jobs/{id}/contact`: giriş yapmış üyenin işveren numarasını görmesi.
- `GET|POST /api/jobs/{id}/applications/{applicationId}/messages`: yalnızca kabul edilmiş başvurunun işveren ve başvuranı arasında sohbet.
- `GET|PUT /api/me/preferences`: favori bölgeler, iş türleri ve uygulama içi bildirim tercihleri.
- `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/{id}/read`, `POST /api/notifications/read-all`: kullanıcı bildirim kutusu ve okundu durumu.
- `POST /api/reports`: giriş yapmış üye ilan veya üyeyi bildirir; kayıt `Reports` tablosunda inceleme bekler.
- `GET /api/reports/moderation`, `PATCH /api/reports/moderation/{id}`: `X-Moderation-Key` ile bekleyen raporları inceleme ve kapatma. Sunucuda güçlü bir `Moderation__AdminKey` ayarlanmadıysa moderasyon uçları kapalıdır.
- `PUT|DELETE /api/devices/push-token`: mobil uygulama cihazının Expo Push belirtecini kaydetme ve çıkışta kaldırma.

Yeni ilan eşleşmeleri, başvuru yanıtları ve kabul edilmiş sohbetlerdeki yeni mesajlar hem uygulama içi bildirim oluşturur hem kayıtlı mobil cihazlara Expo Push gönderir. Eşleşen ilan için favoriler kaydedilirken mevcut açık ve gerçek ilanlar da taranır. Push'ı açmak için Expo hesabında uygulamayı EAS projesine bağla (`npx eas-cli@latest init`), `.env.local` dosyasındaki `EXPO_PUBLIC_EAS_PROJECT_ID` değerini doldur ve EAS proje kimliğini bağladıktan sonra `npx eas-cli@latest build --profile development --platform android` ile telefona development build al. EAS Android push kimlik bilgilerini kurmalıdır. Push Expo Go veya web tarayıcısında çalışmaz; web push için yayın alan adı ve VAPID/service worker yapılandırması ayrıca gerekir. Expo Push gönderimi API sunucusunun dış ağa erişmesini gerektirir.

İlan düzenleme ve rapor gönderimi mobil/web ilan detayında kullanılabilir. Raporlar veritabanında `pending` olarak saklanır ve moderasyon uçlarıyla `reviewed` veya `dismissed` olarak kapatılabilir.

API verisi SQLite ve EF Core ile `api/App_Data/yevmiye.db` dosyasında tutulur. API açılırken EF Core migration'larını uygular; migration'lar `api/Data/Migrations` altında saklanır. İlk geçişte varsa eski JSON dosyaları içeri aktarılır ve yedek olarak yerinde bırakılır. Yeni şema değişikliklerinde API'yi durdurup `api` klasöründe `dotnet ef migrations add MigrationAdi` komutunu çalıştır; API açılışında migration otomatik uygulanır. Üye şifreleri PBKDF2 ile özetlenir. Mobil oturum belirteci SecureStore'da, web belirteci tarayıcı depolamasında saklanır; sunucu tarafındaki belirteç özeti SQLite'ta tutulur ve 30 gün sonra geçersiz olur.

## Yayına hazırlık

- API'yi HTTPS kullanan bir hostta çalıştır. `ConnectionStrings__Default` değerini kalıcı diskteki SQLite dosyasına yönlendir; geçici konteyner diskine bırakma.
- Web istemcisini derlerken `EXPO_PUBLIC_API_URL` değerini `https://api.ornek-alan-adin/api` biçiminde ayarla.
- Üretim API'sinde web erişimi için `Cors__AllowedOrigins__0` değerini `https://web.ornek-alan-adin` olarak ayarla. Her ek web alan adı için `Cors__AllowedOrigins__1`, `__2` şeklinde izin ekle. Geliştirme ortamındaki localhost izinleri üretime açılmaz.
- `App_Data/yevmiye.db` dosyası ve JSON yedekleri için düzenli yedekleme planı kur. Bu prototip otomatik yedek üretmez.
- Gerçek kullanıcılarla açmadan önce gizlilik metni, kullanım koşulları, iletişim kanalı ve verilerin silinmesi sürecini belirle.

Başlangıçtaki üç ilan örnektir ve başvuru kabul etmez. Geliştirme CORS ayarı localhost/loopback web kökenlerine açıktır.
