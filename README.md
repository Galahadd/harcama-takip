# Aylik Harcama Takibi

Kisisel kullanim icin tasarlanmis Next.js uygulamasi. Garanti BBVA kredi karti ekstresi PDF'lerini okuyup aylik harcamalari sektor bazinda takip eder, pasta grafikle dagilimi gosterir ve manuel harcama girisine izin verir.

## Ozellikler

- Tek sifreli giris
- Garanti BBVA metin PDF ekstresi onizleme ve ice aktarma
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
```

Varsayilan lokal sifre `admin`, ancak deploy etmeden once `APP_PASSWORD` ve `AUTH_SECRET` mutlaka ayarlanmalidir.

## Vercel Deploy

1. Projeyi GitHub'a push edin.
2. Vercel'de yeni proje olarak import edin.
3. Environment Variables alanina `APP_PASSWORD`, `AUTH_SECRET`, `DATABASE_URL` ekleyin.
4. PostgreSQL icin Supabase veya Neon kullanabilirsiniz.
5. Deploy edin. Uygulama ilk API isteginde gerekli tablolari otomatik olusturur.

## Notlar

- PDF parser metin secilebilir PDF'ler icindir; OCR yoktur.
- Ilk banka formati Garanti BBVA olarak hedeflenmistir. Gercek ekstrede satir yapisi farkliysa `src/lib/pdf.ts` icindeki regex/parser uyarlanmalidir.
- Taksitli harcamalar ekstrede gorunen aylik tutar kadar kaydedilir.
