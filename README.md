# Aylik Harcama Takibi

Kisisel kullanim icin tasarlanmis Next.js uygulamasi. Garanti BBVA kredi karti ekstresi PDF'lerini okuyup aylik harcamalari sektor bazinda takip eder, pasta grafikle dagilimi gosterir ve manuel harcama girisine izin verir.

## Ozellikler

- Tek sifreli giris
- Garanti BBVA PDF, metin katmanli Yapi Kredi PDF ve Yapi Kredi Excel ekstresi onizleme ve ice aktarma
- PDF satirlarinda sektor duzeltme ve kategori kurali ogrenme
- Manuel harcama ekleme, duzenleme ve silme
- Aylik toplam, sektor toplam tablosu ve pasta grafik
- Duplicate harcama engelleme
- PDF dosyasini public storage yerine PostgreSQL `bytea` tablosunda private saklama

## Kurulum

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` degerleri:

```bash
APP_PASSWORD=change-this-password
AUTH_SECRET=change-this-long-random-secret
DATABASE_URL=postgres://user:password@host:5432/database?sslmode=require
ALTINAPI_API_KEY=your-altinapi-key
```

Uygulama veritabani baglantisi icin sirasiyla `DATABASE_URL`, `POSTGRES_URL`, `SUPABASE_DATABASE_URL` ve `SUPABASE_DB_URL` degiskenlerine bakar. Vercel/Supabase entegrasyonu farkli isimde baglanti adresi urettiyse bunu `DATABASE_URL` olarak kopyalamak en net yoldur.

Varsayilan lokal sifre `admin`, ancak deploy etmeden once `APP_PASSWORD` ve `AUTH_SECRET` mutlaka ayarlanmalidir.

## Vercel Deploy

1. Projeyi GitHub'a push edin.
2. Vercel'de yeni proje olarak import edin.
3. Environment Variables alanina `APP_PASSWORD`, `AUTH_SECRET`, `ALTINAPI_API_KEY` ve PostgreSQL connection string ekleyin. Tavsiye edilen isim `DATABASE_URL`.
4. PostgreSQL icin Supabase veya Neon kullanabilirsiniz.
5. Supabase connection string `sslmode=require` ile bitmelidir.
6. Deploy edin. Uygulama ilk API isteginde gerekli tablolari otomatik olusturur.

## Notlar

- Yatırımlar sayfası AltinAPI `/api/v1/prices` yanıtındaki `ALTIN.bid` (24 ayar gram) ve `AYAR22.bid` (22 ayar gram) alış fiyatlarını kullanır. API anahtarı yalnızca sunucuda `ALTINAPI_API_KEY` değişkeninde saklanır; `NEXT_PUBLIC_` öneki kullanılmaz.
- Fiyatlar sayfa açılışında ve yenile düğmesiyle alınır; sunucuda 5 dakika önbellek kullanılır. Veri zamanı ve varsa piyasa kapalı/güncel olmayan veri uyarısı gösterilir. API hatasında değerler boş bırakılır ve tekrar deneme sunulur.
- Kâr/zarar yalnızca alış maliyeti girilmiş kayıtlar için hesaplanır; maliyeti olmayan kayıtların güncel değeri portföy toplamına dahil edilir.

- PDF parser metin secilebilir PDF'ler icindir; OCR yoktur. Tarayicidan `Print to PDF` ile uretilen ve metin katmani olmayan Yapi Kredi dosyalari yerine Yapi Kredi Excel hesap ozeti (`.xls`/`.xlsx`) kullanilabilir.
- Desteklenen ilk banka formatlari Garanti BBVA ve Yapi Kredi'dir. Gercek ekstrede satir yapisi farkliysa `src/lib/pdf.ts` icindeki parser uyarlanmalidir.
- Taksitli harcamalar ekstrede gorunen aylik tutar kadar kaydedilir.
