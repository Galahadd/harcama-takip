# Codex Cloud: skill ve MCP aktarımı

## Hazırlanan kapsam

- Bu projede kullanılan `ui-ux-pro-max`, `.agents/skills/ui-ux-pro-max/` altında veri setleri, referansları ve Python araçlarıyla birlikte bulunur. Kişisel Windows klasörüne veya `CLAUDE_PLUGIN_ROOT` değişkenine ihtiyaç duymaz.
- 21st ve MotionSites için gizli değer içermeyen bağlantı tanımları `.codex/mcp.cloud.toml.example` içindedir. Bu dosya bir örnektir; kendi başına bağlantı kurmaz ve Cloud'un MCP yükleyicisini yapılandırmaz.
- Kişisel Codex ayarları, oturum/OAuth dosyaları, veritabanı ve şirket/Jira bağlantıları aktarılmadı. Başka projeler için olan kişisel skill'ler ve kurulumla gelen sistem/plugin skill'leri de bu tasarım projesine kopyalanmadı.
- Yerel skill'in kaynak testleri/fixture'ları korunmuştur. Bazı testler upstream repository yapısına ihtiyaç duyar; bu uygulamanın Cloud doğrulaması aşağıdaki bağımsız kontrolü kullanır.

## Cloud ortamında yapılacaklar

1. Bu dosyaları içeren commit'i Cloud ortamının bağlı olduğu GitHub branch'ine gönder. Yereldeki dosyalar Cloud'a kendiliğinden gitmez.
2. **Settings → Codex Cloud → Environments → ilgili ortam → Edit** üzerinden ortamı aç. Bu repository'nin seçili olduğunu doğrula.
3. Ortam hazırlığında Python 3 ve projenin Node/npm araçlarının bulunduğunu doğrula. Skill için ek Python paketi gerekmez. Uygulama bağımlılıkları için `npm ci` kullan.
4. `python3 scripts/check-codex-cloud.py` çalıştır. Skill araması ve taşınabilir dosya yapısı yerelde de bu komutla kontrol edilebilir.
5. Değişiklikleri kaydet, ortamı **Republish** et ve yeni bir Cloud görevi aç. Mevcut görevler kendi önceki durumlarını koruyabilir.
6. Yeni görevden `$ui-ux-pro-max` ile tasarım rehberi araması iste. Kullandığı yolun repository içindeki skill olduğunu kontrol et.

## MCP bağlantıları: hazırlık ile etkin kullanım farklıdır

OpenAI'nin MCP rehberi, `.codex/config.toml` ayarlarını desteklenen Codex host'ları için açıklar. Cloud ortam rehberi repository skill'lerini açıkça destekler; bu örnek dosyanın her Cloud sürümünde otomatik olarak okunacağını garanti etmez. Bu nedenle yerel makinedeki çalışan yapılandırmayı değiştirmedik ve örneği otomatik etkinleştirmedik.

Hedef Cloud ortamı MCP yapılandırması sunuyorsa örnekteki sunucu tanımlarını onun desteklediği yapılandırmaya ekle. Sunucuların yeni görevin araç listesinde görünmesini ve gerçek bir salt-okunur çağrının başarılı olmasını doğrula. Sadece HTTPS erişimi veya başarılı kurulum yeterli değildir. MCP yapılandırma seçeneği ya da araçları görünmüyorsa bu durumu eksik destek/erişim olarak raporla; etkin bağlantı varmış gibi davranma.

### 21st

- Sunucu: `https://21st.dev/api/mcp`.
- Yerel kurulum `x-api-key` başlığı kullanıyor. Örnek dosya gerçek anahtar yerine `TWENTY_FIRST_API_KEY` adlı ortam değişkenini referans alır.
- Anahtarı sohbet mesajına, repository'ye veya komut satırı argümanlarına yapıştırma. Cloud ortamının güvenli değer yönetiminden sağla. HTTP istemcisi yönetilen proxy üzerinden gidiyorsa yalnızca `21st.dev` hedefli bir Network secret tercih edilebilir; aksi durumda ortam değişkeni yönteminin desteklendiğini kontrol et.
- Gerekli ağ hedefleri: `21st.dev`; görsel önizleme gerektiğinde `cdn.21st.dev`. Paket kurulumu için Package managers preset kullanılabilir. Tüm internete erişim açmak gerekmez.
- Doğrulama: ücretsiz şablonları arayan bir `search` çağrısı. `get_component` gibi kod alma araçları ücretli/kotalı olabilir; yalnızca metadata araması bağlantıyı test etmek için yeterlidir.

### MotionSites

- Yerel tanım `npx mcp-remote` üzerinden `https://xgdzyqfalbibzelpdpvr.supabase.co/functions/v1/mcp` adresine gidiyor. Sunucu aslında uzaktadır; yerel köprü sürecinin Windows'a bağımlı parçalarını taşımak gerekmez.
- Cloud ağ listesinde bu **tam hostname** gerekli olabilir. `supabase.co` ana alan adını eklemek tüm alt alan adlarını kapsamaz.
- Yerel tanımda ayrı bir anahtar/header yoktu. Bu, sunucunun Cloud IP'lerinden erişilebilir veya kimlik doğrulamasız çalışır olduğunu garanti etmez; hedefte kontrol et.
- Yeni görevde araç listesini ve ücretsiz arka plan araması gibi salt-okunur bir işlemi doğrula. Hesap oluşturma, ücretli indirme veya yayınlama yapma. Araç çağrısı başarısızsa erişimi açıkça eksik olarak bildir.

## Güvenlik ve doğrulama sınırı

Bu repository değişikliği Cloud hesabını, ağ izinlerini veya sırlarını otomatik değiştirmez. Hazırlık kontrolü dış servis çağırmaz ve sırları okumaz/yazmaz. Gerçek Cloud doğrulaması, anahtar girilmesi ve ortamın yayınlanması ayrıca gerekir. Bu hazırlık herhangi bir MCP'nin Cloud'da aktif olduğuna dair bir başarı iddiası değildir.

## Resmî kaynaklar

- [Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments) — repository skill'leri, ortam güncelleme/yayınlama ve güvenli değerler.
- [Build skills](https://learn.chatgpt.com/docs/build-skills) — `.agents/skills` keşfi ve taşınabilir kaynaklar.
- [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) — HTTP sunucuları, `env_http_headers`, araç izinleri ve desteklenen host yapılandırması.
