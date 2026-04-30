import { Box, Container, Divider, Typography } from "@mui/material";

export const PrivacyPolicy = () => {
    return (
        <Container maxWidth="md" sx={{ py: 6 }}>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 1 }}>
                Gizlilik Politikası ve KVKK Aydınlatma Metni
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 4 }}>
                Son güncelleme: Nisan 2026
            </Typography>

            <Divider sx={{ mb: 4 }} />

            <Section title="1. Veri Sorumlusu">
                6698 Sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, kişisel
                verileriniz veri sorumlusu sıfatıyla <strong>QR MENU DEMO</strong> tarafından
                aşağıda açıklanan kapsamda işlenmektedir.
                <br /><br />
                <strong>Veri Sorumlusu:</strong> QR MENU DEMO<br />
                <strong>Adres: -</strong> —<br />
                <strong>E-posta:</strong>-
            </Section>

            <Section title="2. İşlenen Kişisel Veriler">
                Platformumuz aracılığıyla aşağıdaki kişisel veriler toplanabilmektedir:
                <br /><br />
                • <strong>Kimlik verileri:</strong> Ad, soyad<br />
                • <strong>İletişim verileri:</strong> Telefon numarası, e-posta adresi<br />
                • <strong>İşlem verileri:</strong> Sipariş bilgileri, sipariş tarihi ve tutarı<br />
                • <strong>Teknik veriler:</strong> QR kod masa oturum bilgileri
            </Section>

            <Section title="3. Kişisel Verilerin İşlenme Amaçları">
                Toplanan kişisel veriler aşağıdaki amaçlarla işlenmektedir:
                <br /><br />
                • Sipariş alınması, hazırlanması ve teslim süreçlerinin yürütülmesi<br />
                • Müşteri ile iletişim kurulması<br />
                • Yasal yükümlülüklerin yerine getirilmesi<br />
                • Hizmet kalitesinin geliştirilmesi<br />
                • Muhasebe ve fatura işlemlerinin yürütülmesi
            </Section>

            <Section title="4. Hukuki Dayanak">
                Kişisel verileriniz KVKK'nın 5. maddesi uyarınca aşağıdaki hukuki sebeplere
                dayanılarak işlenmektedir:
                <br /><br />
                • Sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması (m. 5/2-c)<br />
                • Veri sorumlusunun meşru menfaatleri (m. 5/2-f)<br />
                • Hukuki yükümlülüğün yerine getirilmesi (m. 5/2-ç)<br />
                • Açık rızanız (ilgili durumlarda)
            </Section>

            <Section title="5. Kişisel Verilerin Aktarılması">
                Kişisel verileriniz; yasal zorunluluklar dışında üçüncü taraflara
                satılmamakta veya kiralanmamaktadır. Verileriniz yalnızca aşağıdaki
                durumlarda paylaşılabilir:
                <br /><br />
                • Yasal yükümlülükler kapsamında yetkili kamu kurum ve kuruluşlarıyla<br />
                • Hizmetin sunulması için zorunlu olan teknik altyapı sağlayıcılarıyla
                (Firebase / Google Cloud — sunucular AB bölgesinde konumlandırılmıştır)
            </Section>

            <Section title="6. Verilerin Saklanma Süresi">
                Kişisel verileriniz, işlenme amacının gerektirdiği süre boyunca ve
                ilgili mevzuatta öngörülen zamanaşımı süreleri gözetilerek saklanmaktadır.
                Bu sürenin sonunda veriler silinmekte, yok edilmekte veya anonim hale
                getirilmektedir. Sipariş verileri en fazla 2 yıl süreyle saklanmaktadır.
            </Section>

            <Section title="7. Çerezler (Cookie) Politikası">
                Sitemizde yalnızca teknik açıdan zorunlu olan oturum çerezleri kullanılmaktadır.
                Bu çerezler; kullanıcı oturumunun yönetilmesi ve güvenli sipariş sürecinin
                sürdürülmesi amacıyla kullanılır. Analitik veya pazarlama amaçlı çerez
                kullanılmamaktadır.
            </Section>

            <Section title="8. KVKK Kapsamındaki Haklarınız">
                KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:
                <br /><br />
                • Kişisel verilerinizin işlenip işlenmediğini öğrenme<br />
                • İşlenmişse buna ilişkin bilgi talep etme<br />
                • İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme<br />
                • Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme<br />
                • Eksik veya yanlış işlenmişse düzeltilmesini isteme<br />
                • Silinmesini veya yok edilmesini isteme<br />
                • İşlenmesine itiraz etme<br />
                • Otomatik sistemlerle analiz sonucu aleyhine bir sonuç doğurmuşsa
                itiraz etme<br />
                • Zararın giderilmesini talep etme
                <br /><br />
                Bu haklarınızı kullanmak için <strong>QR MENU DEMO</strong> ile iletişim kurabilirsiniz.
            </Section>

            <Section title="9. Veri Güvenliği">
                Kişisel verilerinizin güvenliğini sağlamak amacıyla uygun teknik ve idari
                tedbirler alınmaktadır. Veriler şifreli bağlantılar (HTTPS) üzerinden iletilmekte
                ve güvenli altyapılarda (Firebase / Google Cloud) saklanmaktadır.
            </Section>

            <Section title="10. Değişiklikler">
                Bu gizlilik politikası zaman zaman güncellenebilir. Güncellemeler bu sayfada
                yayımlanır. Önemli değişiklikler için kullanıcılar bilgilendirilebilir.
                Siteyi kullanmaya devam etmeniz güncel politikayı kabul ettiğiniz anlamına gelir.
            </Section>

            <Section title="11. İletişim ve Başvuru">
                Kişisel verilerinize ilişkin her türlü soru, talep veya şikâyet için:
                <br /><br />
                <strong>QR MENU DEMO</strong><br />
                E-posta: -<br />
                Telefon: -<br />
                Adres: -<br /><br />
                Başvurunuz en geç <strong>30 gün</strong> içinde yanıtlanacaktır.
                Yanıttan memnun kalmamanız halinde <strong>Kişisel Verileri Koruma Kurumu
                (KVKK)</strong>'na şikâyette bulunma hakkınız saklıdır.
            </Section>
        </Container>
    );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
            {title}
        </Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.9 }}>
            {children}
        </Typography>
    </Box>
);
