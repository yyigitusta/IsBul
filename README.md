# Yevmiyem â€” Ä°znik gÃ¼nlÃ¼k iÅŸ ilanlarÄ±

Ä°ÅŸ arayanlarla gÃ¼nlÃ¼k iÅŸÃ§i arayan iÅŸverenleri Ä°znik'te buluÅŸturan web ve mobil uygulama baÅŸlangÄ±cÄ±.

## Proje yapÄ±sÄ±

- `app/`: Expo + React Native arayÃ¼zÃ¼ (Android, iOS ve web)
- `api/`: ASP.NET Core 8 Web API
- `api/App_Data/jobs.json`: geliÅŸtirme API'sinin kalÄ±cÄ± ilan dosyasÄ±

## Ã‡alÄ±ÅŸtÄ±rma

API'yi bir terminalde baÅŸlat:

```powershell
cd api
dotnet run --launch-profile http
```

Expo arayÃ¼zÃ¼nÃ¼ baÅŸka bir terminalde baÅŸlat:

```powershell
cd app
npm install
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-secure-store
npx expo install react-dom react-native-web
npm run web
```

Web arayÃ¼zÃ¼ varsayÄ±lan olarak API'yi `http://localhost:5160/api` adresinde arar. FarklÄ± bir adres kullanÄ±yorsan `app/.env.example` dosyasÄ±nÄ± `app/.env.local` adÄ±yla kopyalayÄ±p `EXPO_PUBLIC_API_URL` deÄŸerini gÃ¼ncelle. Fiziksel telefonda `localhost` yerine bilgisayarÄ±nÄ±n yerel aÄŸ adresini kullan.

## API

- `GET /api/jobs`: arama, kategori, alan, yevmiye aralÄ±ÄŸÄ±, iÅŸ tarihi, sÄ±ralama ve sayfalama. YanÄ±t gÃ¶vdesi ilan dizisi olarak kalÄ±r; toplam ve sayfa bilgileri `X-Total-Count`, `X-Page` ve `X-Page-Size` baÅŸlÄ±klarÄ±ndadÄ±r.
- `GET /api/jobs/categories`: ilan kategorileri.
- `GET /api/jobs/areas`: favori konumlarda kullanÄ±labilen bÃ¶lgeler.
- `GET /api/jobs/{id}`: tek ilan.
- `PATCH /api/jobs/{id}/status`: ilan sahibi ilanÄ± `open`, `filled` veya `cancelled` durumuna alÄ±r.
- `PUT /api/jobs/{id}`: ilan sahibi ilan ayrÄ±ntÄ±larÄ±nÄ± gÃ¼nceller.
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`: telefon ve ÅŸifre ile Ã¼yelik/giriÅŸ. KorumalÄ± uÃ§ noktalar `Authorization: Bearer <token>` ister.
- `POST /api/jobs`: oturum aÃ§mÄ±ÅŸ Ã¼yenin ilanÄ±. Her hesap hem ilan verebilir hem baÅŸka ilana baÅŸvurabilir.
- `POST /api/jobs/{id}/applications`: oturum aÃ§mÄ±ÅŸ Ã¼yenin baÅŸvurusu; aynÄ± ilana ikinci baÅŸvuru ve kendi ilanÄ±na baÅŸvuru engellenir.
- `GET /api/jobs/{id}/applications`: yalnÄ±zca ilan sahibinin baÅŸvurularÄ± gÃ¶rmesi.
- `PATCH /api/jobs/{id}/applications/{applicationId}`: ilan sahibinin baÅŸvuruyu `accepted` veya `declined` yapmasÄ±.
- `GET /api/jobs/{id}/contact`: giriÅŸ yapmÄ±ÅŸ Ã¼yenin iÅŸveren numarasÄ±nÄ± gÃ¶rmesi.
- `GET|POST /api/jobs/{id}/applications/{applicationId}/messages`: yalnÄ±zca kabul edilmiÅŸ baÅŸvurunun iÅŸveren ve baÅŸvuranÄ± arasÄ±nda sohbet.
- `GET|PUT /api/me/preferences`: favori bÃ¶lgeler, iÅŸ tÃ¼rleri ve uygulama iÃ§i bildirim tercihleri.
- `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/{id}/read`, `POST /api/notifications/read-all`: kullanÄ±cÄ± bildirim kutusu ve okundu durumu.
- `POST /api/reports`: giriÅŸ yapmÄ±ÅŸ Ã¼ye ilan veya Ã¼yeyi bildirir; kayÄ±t `Reports` tablosunda inceleme bekler.
- `GET /api/reports/moderation`, `PATCH /api/reports/moderation/{id}`: `X-Moderation-Key` ile bekleyen raporlarÄ± inceleme ve kapatma. Sunucuda gÃ¼Ã§lÃ¼ bir `Moderation__AdminKey` ayarlanmadÄ±ysa moderasyon uÃ§larÄ± kapalÄ±dÄ±r.
- `PUT|DELETE /api/devices/push-token`: mobil uygulama cihazÄ±nÄ±n Expo Push belirtecini kaydetme ve Ã§Ä±kÄ±ÅŸta kaldÄ±rma.

Yeni ilan eÅŸleÅŸmeleri, baÅŸvuru yanÄ±tlarÄ± ve kabul edilmiÅŸ sohbetlerdeki yeni mesajlar hem uygulama iÃ§i bildirim oluÅŸturur hem kayÄ±tlÄ± mobil cihazlara Expo Push gÃ¶nderir. EÅŸleÅŸen ilan iÃ§in favoriler kaydedilirken mevcut aÃ§Ä±k ve gerÃ§ek ilanlar da taranÄ±r. Push'Ä± aÃ§mak iÃ§in Expo hesabÄ±nda uygulamayÄ± EAS projesine baÄŸla (`npx eas-cli@latest init`), `.env.local` dosyasÄ±ndaki `EXPO_PUBLIC_EAS_PROJECT_ID` deÄŸerini doldur ve EAS proje kimliÄŸini baÄŸladÄ±ktan sonra `npx eas-cli@latest build --profile development --platform android` ile telefona development build al. EAS Android push kimlik bilgilerini kurmalÄ±dÄ±r. Push Expo Go veya web tarayÄ±cÄ±sÄ±nda Ã§alÄ±ÅŸmaz; web push iÃ§in yayÄ±n alan adÄ± ve VAPID/service worker yapÄ±landÄ±rmasÄ± ayrÄ±ca gerekir. Expo Push gÃ¶nderimi API sunucusunun dÄ±ÅŸ aÄŸa eriÅŸmesini gerektirir.

Ä°lan dÃ¼zenleme ve rapor gÃ¶nderimi mobil/web ilan detayÄ±nda kullanÄ±labilir. Raporlar veritabanÄ±nda `pending` olarak saklanÄ±r ve moderasyon uÃ§larÄ±yla `reviewed` veya `dismissed` olarak kapatÄ±labilir.

API verisi SQLite ve EF Core ile `api/App_Data/yevmiye.db` dosyasÄ±nda tutulur. API aÃ§Ä±lÄ±rken EF Core migration'larÄ±nÄ± uygular; migration'lar `api/Data/Migrations` altÄ±nda saklanÄ±r. Ä°lk geÃ§iÅŸte varsa eski JSON dosyalarÄ± iÃ§eri aktarÄ±lÄ±r ve yedek olarak yerinde bÄ±rakÄ±lÄ±r. Yeni ÅŸema deÄŸiÅŸikliklerinde API'yi durdurup `api` klasÃ¶rÃ¼nde `dotnet ef migrations add MigrationAdi` komutunu Ã§alÄ±ÅŸtÄ±r; API aÃ§Ä±lÄ±ÅŸÄ±nda migration otomatik uygulanÄ±r. Ãœye ÅŸifreleri PBKDF2 ile Ã¶zetlenir. Mobil oturum belirteci SecureStore'da, web belirteci tarayÄ±cÄ± depolamasÄ±nda saklanÄ±r; sunucu tarafÄ±ndaki belirteÃ§ Ã¶zeti SQLite'ta tutulur ve 30 gÃ¼n sonra geÃ§ersiz olur.

## YayÄ±na hazÄ±rlÄ±k

- API'yi HTTPS kullanan bir hostta Ã§alÄ±ÅŸtÄ±r. `ConnectionStrings__Default` deÄŸerini kalÄ±cÄ± diskteki SQLite dosyasÄ±na yÃ¶nlendir; geÃ§ici konteyner diskine bÄ±rakma.
- Web istemcisini derlerken `EXPO_PUBLIC_API_URL` deÄŸerini `https://api.ornek-alan-adin/api` biÃ§iminde ayarla.
- Ãœretim API'sinde web eriÅŸimi iÃ§in `Cors__AllowedOrigins__0` deÄŸerini `https://web.ornek-alan-adin` olarak ayarla. Her ek web alan adÄ± iÃ§in `Cors__AllowedOrigins__1`, `__2` ÅŸeklinde izin ekle. GeliÅŸtirme ortamÄ±ndaki localhost izinleri Ã¼retime aÃ§Ä±lmaz.
- `App_Data/yevmiye.db` dosyasÄ± ve JSON yedekleri iÃ§in dÃ¼zenli yedekleme planÄ± kur. Bu prototip otomatik yedek Ã¼retmez.
- GerÃ§ek kullanÄ±cÄ±larla aÃ§madan Ã¶nce gizlilik metni, kullanÄ±m koÅŸullarÄ±, iletiÅŸim kanalÄ± ve verilerin silinmesi sÃ¼recini belirle.

BaÅŸlangÄ±Ã§taki Ã¼Ã§ ilan Ã¶rnektir ve baÅŸvuru kabul etmez. GeliÅŸtirme CORS ayarÄ± localhost/loopback web kÃ¶kenlerine aÃ§Ä±ktÄ±r.

