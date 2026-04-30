import { Box, Container, Divider, Typography } from "@mui/material";

export const TermsOfService = () => {
    return (
        <Container maxWidth="md" sx={{ py: 6 }}>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 1 }}>
                Kullanım Koşulları
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", mb: 4 }}>
                Son güncelleme: Nisan 2026
            </Typography>

            <Divider sx={{ mb: 4 }} />

            <Section title="1. Genel Bilgiler">
                Bu web sitesi, QR MENU DEMO tarafından işletilmektedir. Sitemizi kullanarak
                aşağıda belirtilen kullanım koşullarını kabul etmiş sayılırsınız. Bu koşulları
                kabul etmiyorsanız lütfen sitemizi kullanmayınız.
            </Section>

            <Section title="2. Hizmetin Kapsamı">
                Platformumuz, müşterilerin masa başından dijital menüyü görüntüleyerek sipariş verebilmesine
                olanak tanıyan bir restoran sipariş sistemidir. Bunun yanı sıra dükkan dışından da sipariş
                verilebilmektedir. Sunulan hizmet; menü görüntüleme, sipariş oluşturma ve ödeme bilgisi
                iletimini kapsamaktadır.
            </Section>

            <Section title="3. Kullanıcı Yükümlülükleri">
                Kullanıcılar, sitemizi yalnızca yasal amaçlar doğrultusunda kullanmayı,
                üçüncü kişilerin haklarını ihlal etmemeyi, sistemi kötüye kullanmamayı ve
                yanıltıcı bilgi vermemeyi kabul eder. Sisteme zarar verici yazılım yüklenmesi
                veya yetkisiz erişim girişimleri yasal yaptırımlara konu olabilir.
            </Section>

            <Section title="4. Sipariş ve Ödeme">
                Sistemimiz üzerinden verilen siparişler, restoran tarafından onaylandıktan
                sonra geçerlilik kazanır. Ödeme; nakit veya kart ile kapıda gerçekleştirilmektedir.
                Verilen siparişlerin iptali için lütfen restoran personeliyle iletişime geçiniz.
                Hazırlanmaya başlanan siparişler için iptal mümkün olmayabilir.
            </Section>

            <Section title="5. Fiyatlar ve Menü">
                Menüde yer alan fiyatlar KDV dahil olup önceden haber verilmeksizin
                değiştirilebilir. Stok durumuna göre bazı ürünler geçici olarak temin
                edilemeyebilir. Menü içeriği ve fiyatlar restoran tarafından güncellenmektedir.
            </Section>

            <Section title="6. Fikri Mülkiyet">
                Bu web sitesinde kullanılan yazılım, üçüncü taraf bir geliştirici tarafından oluşturulmuş
                olup aylık kiralama yöntemiyle kullanılmaktadır. Yazılımın mülkiyeti geliştiriciye aittir.
                Sitedeki görseller, metinler ve marka unsurları QR MENU DEMO ya aittir ve izinsiz kullanılamaz.
            </Section>

            <Section title="7. Sorumluluk Sınırlaması">
                Teknik arızalar, internet kesintileri veya üçüncü taraf hizmetlerinden
                kaynaklanan sorunlar nedeniyle oluşan gecikmelerden veya hizmet
                aksaklıklarından işletmemiz sorumlu tutulamaz. Sistem kesintisiz hizmet
                garantisi vermemektedir.
            </Section>

            <Section title="8. Değişiklikler">
                Kullanım koşulları önceden haber verilmeksizin güncellenebilir. Güncellemeler
                bu sayfada yayımlanır ve yayımlandığı tarihten itibaren geçerli olur. Siteyi
                kullanmaya devam etmeniz güncellenmiş koşulları kabul ettiğiniz anlamına gelir.
            </Section>

            <Section title="9. Uygulanacak Hukuk ve Yetki">
                Bu koşullar Türkiye Cumhuriyeti kanunlarına tabidir. Uyuşmazlıklarda Bartın mahkemeleri
                ve icra daireleri yetkilidir.
            </Section>

            <Section title="10. İletişim">
                Kullanım koşullarına ilişkin sorularınız için bizimle iletişime geçebilirsiniz:
                <br /><br />
                <strong>QR MENU DEMO</strong><br />
                E-posta: -<br />
                Telefon: -<br />
                Adres: -
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
