# Aylik Harcama Takibi

Kisisel kullanim icin tasarlanmis Next.js uygulamasi. Garanti BBVA kredi karti ekstresi PDF'lerini okuyup aylik harcamalari sektor bazinda takip eder, pasta grafikle dagilimi gosterir ve manuel harcama girisine izin verir.

## Ozellikler

- Kullanici adiyla hesap secimi ve yeni kullanici olusturma
- Harcama, ekstre, taksit ve yatirim kayitlarinda kullanici bazli veri ayrimi
- Garanti BBVA PDF, metin katmanli Yapi Kredi PDF ve Yapi Kredi Excel ekstresi onizleme ve ice aktarma
- PDF satirlarinda sektor duzeltme ve kategori kurali ogrenme
- Manuel harcama ekleme, duzenleme ve silme
- Aylik toplam, sektor toplam tablosu ve pasta grafik
- Duplicate harcama engelleme
- PDF dosyasini public storage yerine PostgreSQL `bytea` tablosunda private saklama

## Kurulum

Codex Cloud'da repository skill'lerini kullanmak ve 21st/MotionSites bağlantılarını hazırlamak için [Cloud kurulum notlarına](docs/CODEX_CLOUD.md) bakın. Yerel hazırlığı `python3 scripts/check-codex-cloud.py` ile kontrol edebilirsiniz. Bu kontrol MCP bağlantılarını etkinleştirmez veya sırları aktarmaz.

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` degerleri:

```bash
AUTH_SECRET=change-this-long-random-secret
DATABASE_URL=postgres://user:password@host:5432/database?sslmode=require
ALTINAPI_API_KEY=your-altinapi-key
```

Uygulama veritabani baglantisi icin sirasiyla `DATABASE_URL`, `POSTGRES_URL`, `SUPABASE_DATABASE_URL` ve `SUPABASE_DB_URL` degiskenlerine bakar. Vercel/Supabase entegrasyonu farkli isimde baglanti adresi urettiyse bunu `DATABASE_URL` olarak kopyalamak en net yoldur.

Oturumlar kullanici adini iceren imzali bir cookie ile korunur. Deploy etmeden once uzun ve rastgele bir `AUTH_SECRET` ayarlanmalidir.

## Vercel Deploy

1. Projeyi GitHub'a push edin.
2. Vercel'de yeni proje olarak import edin.
3. Environment Variables alanina `AUTH_SECRET`, `ALTINAPI_API_KEY` ve PostgreSQL connection string ekleyin. Tavsiye edilen isim `DATABASE_URL`.
4. PostgreSQL icin Supabase veya Neon kullanabilirsiniz.
5. Supabase connection string `sslmode=require` ile bitmelidir.
6. Deploy edin. Uygulama ilk API isteginde gerekli tablolari otomatik olusturur.

## Notlar

- Giriş ekranı `public/login/index.html` içinde tek dosya olarak tutulur; CSS ve JavaScript dosyanın içindedir, bir arayüz kütüphanesi veya ayrı derleme gerektirmez. Next.js `/login` adresini bu statik dosyaya eşler. Kullanıcı girişi ve oluşturma, aynı origin'deki mevcut `/api/auth/login` ve `/api/auth/users` uçlarını kullanır.
- Giriş tasarımı için 21st kataloğundaki ücretsiz [Fintech SaaS Landing Page Template](https://21st.dev/community/templates/fintech-saas-landing-page-template) içerik referansı seçildi. Şablon kodu alınmadı; verilen video hero tasarımına uyarlanan özgün HTML kullanıldı. Google Fonts ve kullanıcı tarafından sağlanan CloudFront video/poster adresleri doğrudan yüklenir. Hareketi azalt tercihi ve video durdurma düğmesi desteklenir.

- Yatırımlar sayfası AltinAPI `/api/v1/prices` yanıtındaki `ALTIN.bid` (24 ayar gram) ve `AYAR22.bid` (22 ayar gram) alış fiyatlarını kullanır. API anahtarı yalnızca sunucuda `ALTINAPI_API_KEY` değişkeninde saklanır; `NEXT_PUBLIC_` öneki kullanılmaz.
- Fiyatlar sayfa açılışında ve yenile düğmesiyle alınır; sunucuda 5 dakika önbellek kullanılır. Veri zamanı ve varsa piyasa kapalı/güncel olmayan veri uyarısı gösterilir. API hatasında değerler boş bırakılır ve tekrar deneme sunulur.
- Kâr/zarar yalnızca alış maliyeti girilmiş kayıtlar için hesaplanır; maliyeti olmayan kayıtların güncel değeri portföy toplamına dahil edilir.

- PDF parser metin secilebilir PDF'ler icindir; OCR yoktur. Tarayicidan `Print to PDF` ile uretilen ve metin katmani olmayan Yapi Kredi dosyalari yerine Yapi Kredi Excel hesap ozeti (`.xls`/`.xlsx`) kullanilabilir.
- Desteklenen ilk banka formatlari Garanti BBVA ve Yapi Kredi'dir. Gercek ekstrede satir yapisi farkliysa `src/lib/pdf.ts` icindeki parser uyarlanmalidir.
- Taksitli harcamalar ekstrede gorunen aylik tutar kadar kaydedilir.
