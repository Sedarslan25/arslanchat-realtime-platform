# 📡 ArslanChat – Teknik Dokümantasyon ve Proje Raporu

Bu doküman, **İleri Programlama** dersi kapsamında geliştirilen **Web Tabanlı IRC / Canlı Yazışma ve Görüntülü Görüşme Sistemi**'nin teknik detaylarını, mimarisini, veritabanı şemasını ve kurulum adımlarını içermektedir.

---

## 📖 1. Proje Amacı ve Kapsamı
Projenin amacı; öğrencilerin gerçek zamanlı iletişim sistemleri (WebSockets), eşler arası (Peer-to-Peer) sesli/görüntülü iletişim altyapıları (WebRTC), istemci-sunucu mimarileri, güvenli kullanıcı oturumu yönetimi ve veritabanı persistency işlemlerini uygulamalı olarak deneyimlemesidir. Geliştirilen uygulama, klasik **IRC (Internet Relay Chat)** kanallarını ve özel sohbet odalarını modern bir **Web tabanlı kullanıcı arayüzü (SPA - Single Page Application)** ile bir araya getirmekte ve WebRTC standartları ile zenginleştirmektedir.

---

## 🛠 2. Kullanılan Teknolojiler

| Katman | Teknoloji | Açıklama |
|--------|-----------|----------|
| **Backend Sunucusu** | Node.js + Express.js | Yüksek performanslı, olay güdümlü (event-driven) API sunucusu |
| **Veritabanı** | NeDB (Promises tabanlı) | Dosya tabanlı, MongoDB uyumlu, gömülü NoSQL veritabanı |
| **Gerçek Zamanlı İletişim** | WebSocket (`ws` kütüphanesi) | Anlık mesajlaşma, oda durumları ve WebRTC signaling işlemleri |
| **Eşler Arası (P2P) Medya** | WebRTC (Tarayıcı Yerleşik API'si) | Sesli ve görüntülü eşler arası doğrudan medya akışı aktarımı |
| **Oturum Yönetimi** | `express-session` | Sunucu taraflı güvenli oturum çerezleri |
| **Dosya Yükleme** | `multer` | Sunucu tarafında 10MB boyutuna kadar gerçek dosya yükleme desteği |
| **Güvenli Şifreleme** | `bcryptjs` | Şifrelerin 12 salt round kullanılarak tek yönlü hashlenmesi |
| **Ses Sentezleme** | Web Audio API | Dış ses dosyası indirmeden kodla zil sesi üreten sentezleyici |
| **Arayüz Tasarımı (CSS)** | Vanilla CSS3 (Glassmorphic) | Buzlu cam (backdrop-filter) efektli modern neon tasarım sistemi |
| **Konteynerleştirme** | Docker + Docker Compose | Taşınabilir, tek komutla ayağa kaldırılabilir altyapı |

---

## 🗄 3. Sistem Mimarisi ve Veritabanı Tasarımı

Sistem, **İstemci-Sunucu (Client-Server)** modeli üzerine inşa edilmiş olup, gerçek zamanlı kanalları WebSocket protokolü üzerinden yönetmektedir. WebRTC bağlantısı kurulduktan sonra ses ve görüntü verileri doğrudan iki istemci arasında (P2P) akar. Sunucu yalnızca bağlantıyı kurmak için arabuluculuk (Signaling) yapar.

### 📊 Veritabanı Şemaları

#### A. Users Koleksiyonu (`users.db`)
Kullanıcı kayıt ve oturum bilgilerini tutar.
```json
{
  "_id": "Z1aBcDeFgH",
  "username": "kullanici_adi (küçük harfe çevrilir, benzersizdir)",
  "displayName": "Kullanıcı Görünen İsmi (Profilde değiştirilebilir)",
  "password": "bcrypt hash (12 salt round şifrelenmiş veri)",
  "avatar": "SVG formatında inline çizim verisi (Predefined avatarlardan seçilir)",
  "createdAt": "Date (Kayıt tarihi)",
  "online": "boolean (Çevrim içi / çevrim dışı durumu)"
}
```

#### B. Channels Koleksiyonu (`channels.db`)
Genel sohbet odalarının bilgilerini tutar.
```json
{
  "_id": "Y2bCdEfGhI",
  "name": "kanal-adi (küçük harf ve tire içerir, benzersizdir)",
  "topic": "Kanal başlığı veya konusu",
  "createdBy": "kanali_olusturan_kullanici",
  "createdAt": "Date (Oluşturulma tarihi)"
}
```

#### C. Messages Koleksiyonu (`messages.db`)
Tüm genel ve özel (DM) mesaj geçmişini tutar.
```json
{
  "_id": "X3cDeFgHiJ",
  "channel": "#kanal veya dm:gonderen:alici şeklinde benzersiz oda anahtarı",
  "sender": "gonderen_kullanici_adi",
  "senderDisplay": "gonderen_kullanici_gorunen_adi",
  "recipient": "alici_kullanici_adi (Yalnızca DM ise doldurulur)",
  "text": "Mesaj içeriği (Resim URL'si, dosya indirme bağlantısı veya düz metin)",
  "isDM": "boolean (Özel mesaj mı olduğunu belirtir)",
  "edited": "boolean (Mesajın düzenlenip düzenlenmediği bilgisi)",
  "editedAt": "Date (Düzenlenme tarihi, opsiyonel)",
  "createdAt": "Date (Gönderim tarihi)"
}
```

---

## 🔄 4. WebRTC Bağlantı Akışı ve Signaling Yapısı

WebRTC bağlantısının kurulabilmesi için istemcilerin birbirlerinin ağ adreslerini ve medya yeteneklerini (codec'ler vb.) öğrenmesi gerekir. Bu süreç **Signaling (Sinyalleşme)** sunucusu olan WebSocket üzerinden yürütülür.

### 📉 Sinyalleşme Sıralı Diyagramı

```
Arayan İstemci (Alice)            Sinyalleşme Sunucusu (WebSocket)       Aranan İstemci (Bob)
       |                                     |                                     |
       |----- callInvite (Bob'a) ----------->|                                     |
       |                                     |----- callInvite (Bob'a ilet) ------>|
       |                                     |                                     |
       |                                     |<---- callAccept (Alice'e) ----------|
       |<---- callAccept (Alice'e ilet) -----|                                     |
       |                                     |                                     |
[Kamera/Mikrofon Alınır]                     |                           [Kamera/Mikrofon Alınır]
[SDP Offer Oluşturulur]                      |                                     |
       |----- sdpOffer (Bob'a) ------------->|                                     |
       |                                     |----- sdpOffer (Bob'a ilet) -------->|
       |                                     |                           [SDP Answer Oluşturulur]
       |                                     |<---- sdpAnswer (Alice'e) -----------|
       |<---- sdpAnswer (Alice'e ilet) ------|                                     |
       |                                     |                                     |
       |===== ICE Adayları Keşfedilir (ICE Candidates) ============================|
       |----- iceCandidate ----------------->|                                     |
       |                                     |----- iceCandidate ----------------->|
       |<---- iceCandidate ------------------|<---- iceCandidate ------------------|
       |                                     |                                     |
       |===========================================================================|
       |             📡 DOĞRUDAN P2P MEDYA AKIŞI (VİDEO VE SES)                    |
       |===========================================================================|
```

---

## 🔒 5. Güvenlik Önlemleri

1. **Şifre Güvenliği:** Kullanıcı şifreleri `bcryptjs` kütüphanesiyle en güvenli endüstri standartlarından biri olan **12 salt round** ile tek yönlü hashlenerek kaydedilir. Olası bir sızıntıda şifrelerin kırılması engellenir.
2. **Oturum Kontrolü (Session Protection):** `express-session` entegrasyonu ile tüm istekler sunucu tarafında doğrulanır. Oturumu geçerli olmayan kullanıcıların REST API veya WebSocket bağlantı istekleri reddedilir.
3. **XSS Koruması (HTML Sanitization):** Kullanıcılardan gelen tüm mesajlar ve isim bilgileri, DOM'a basılmadan önce `escHtml()` fonksiyonu yardımıyla HTML karakterlerinden arındırılır (sanitize edilir). Script enjeksiyonu engellenir.
4. **WebSocket Doğrulaması:** Yetkisiz soket isteklerini engellemek için `sessionParser` WebSocket el sıkışması (`connection` anı) sırasında doğrudan çalıştırılır ve geçerli bir session çerezi bulunmayan soketler kapatılır.

---

## 🚀 6. Ekstra Özellikler (Bonus Teslim Kriterleri)

Değerlendirmede ek puan kazandıracak ve kullanıcı deneyimini zirveye taşıyan aşağıdaki modüller projeye entegre edilmiştir:

1. **Web Audio API Sentezleyici Sesler (Sıfır Dış Bağımlılık):**
   Uygulama, bildirim sesleri için sunucudan `.mp3` veya `.wav` dosyaları indirmek yerine, tamamen tarayıcının `AudioContext` özelliğini kullanarak anlık olarak **frekans bazlı melodiler** sentezler:
   - *Yeni Mesaj Sesi:* 587Hz ve 880Hz dalgaları ile sentezlenen şık bir "chime" tonu.
   - *Gelen Arama Zil Sesi:* Alice aradığında, Bob'un bilgisayarında kesintisiz 440Hz + 480Hz çift-sinyalli gerçek telefon zil sesi sentezlenir.
2. **Mesaj Düzenleme ve Silme:**
   Kullanıcılar kendi gönderdikleri mesajların üzerine gelerek anında **Düzenleyebilir (Edit)** veya **Silebilir (Delete)**. Bu eylemler WebSocket üzerinden odadaki tüm istemcilere eş zamanlı anons edilir ve DOM anlık olarak güncellenir.
3. **Predefined SVG Profil Avatarları:**
   Kullanıcıların rastgele harfler yerine kendilerini temsil edecekleri modern, yarı şeffaf gradyan geçişlerine sahip **5 farklı premium SVG avatar** kütüphanesi modal arayüzü ile sunulur. Profil güncellemeleri anlık olarak tüm çevrim içi listelerinde güncellenir.
4. **Emoji Seçici Panel:**
   Yazışma alanına entegre edilmiş pratik bir emoji kütüphanesi sayesinde, kullanıcılar tek tıkla mesajlarına emoji ekleyebilirler.
5. **Gerçek Dosya Paylaşımı (Multer Entegrasyonu):**
   İstemci tarafındaki ataç (📎) butonu ile 10MB boyutuna kadar her türden dosya ve görsel, Node.js backend sunucusuna (`POST /api/upload`) yüklenir. Eğer dosya görsel ise sohbet ekranında anında önizlenir, diğer dosya tipleri ise (PDF, zip, docx vb.) şık bir **dosya indirme kartı** olarak listelenir ve indirilebilir.
6. Kanal Yöneticisi & Moderatör Yetkileri:
   Kanalı/odayı oluşturan kullanıcı, odaya girdiğinde isminin yanında otomatik olarak **yönetici tacı (`👑`)** ile işaretlenir. Ayrıca, kanal başlığında sadece oda kurucusuna özel **"Kanalı Sil"** butonu gösterilir. Oda silindiğinde WebSocket aracılığıyla tüm bağlı üyelere bildirim gider ve odadaki üyeler otomatik olarak `#genel` kanalına güvenli şekilde yönlendirilir.
7. Kullanıcı Engelleme (Discord Tarzı Sansür):
   DM sohbet başlığına entegre edilen **"Engelle / Engeli Kaldır"** butonu ve profil modalındaki **Engellenen Kullanıcılar listesi** sayesinde istenmeyen kişiler engellenebilir. Engellenen bir kullanıcı size özel mesaj atmaya çalıştığında hata uyarısı alır. Ortak kanallarda ise engellediğiniz kullanıcının mesajları otomatik olarak katlanmış/sansürlenmiş bir placeholder (`🚫 Engellediğiniz kullanıcıdan mesaj (Göstermek için tıklayın)`) olarak listelenir; üzerine tıklanırsa mesaj açılır.
8. Docker ve Docker Compose Entegrasyonu:
   Proje tek tıkla konteyner üzerinde ayağa kalkabilecek şekilde yapılandırılmıştır.

---

## 📦 7. Kurulum ve Çalıştırma Kılavuzu

### Yöntem A: Klasik Kurulum (Yerel Bilgisayarda)

#### Gereksinimler:
* Node.js v16 veya üzeri
* npm

#### Adımlar:
1. Bağımlılıkları yükleyin:
   ```bash
   npm install
   ```
2. Sunucuyu başlatın:
   ```bash
   node index.js
   ```
3. Tarayıcınızda şu adresi açın:
   ```
   http://localhost:3000
   ```

---

### Yöntem B: Docker İle Çalıştırma (Konteyner Üzerinde)

#### Gereksinimler:
* Docker Desktop kurulu olmalıdır.

#### Adımlar:
1. Projenin bulunduğu ana dizinde terminali (PowerShell veya CMD) açın.
2. Aşağıdaki Docker Compose komutunu çalıştırın:
   ```bash
   docker-compose up --build -d
   ```
3. Konteynerler arka planda hatasız ayağa kalkacaktır. Uygulamaya tarayıcınızdan şu adresten ulaşabilirsiniz:
   ```
   http://localhost:3000
   ```
4. Kapatmak istediğinizde:
   ```bash
   docker-compose down
   ```
