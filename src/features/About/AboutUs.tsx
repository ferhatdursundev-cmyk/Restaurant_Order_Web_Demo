import React, { useCallback } from "react";
import {
    Avatar,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    Divider,
    Stack,
    Typography,
} from "@mui/material";
import RestaurantMenuRoundedIcon from "@mui/icons-material/RestaurantMenuRounded";
import QrCode2RoundedIcon from "@mui/icons-material/QrCode2Rounded";
import PrintRoundedIcon from "@mui/icons-material/PrintRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import DevicesRoundedIcon from "@mui/icons-material/DevicesRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import WorkspacePremiumRoundedIcon from "@mui/icons-material/WorkspacePremiumRounded";
import { useNavigate } from "react-router-dom";

const brand = {
    primary: "#FF7A00",
    dark: "#111827",
    muted: "#6B7280",
    soft: "#FFF4E8",
    card: "rgba(255,255,255,0.82)",
    border: "rgba(17,24,39,0.08)",
};

const features = [
    {
        icon: <RestaurantMenuRoundedIcon />,
        title: "Geleneksel Lahmacun Lezzeti",
        text: "Gunluk hazirlanan hamur ve ozenle secilen ic malzemeyle her zaman ayni lezzet standardini koruyoruz.",
    },
    {
        icon: <QrCode2RoundedIcon />,
        title: "QR ile Kolay Siparis",
        text: "Masadaki QR kodu okutarak saniyeler icinde menuye ulasin, siparisinizikolayca olusturun.",
    },
    {
        icon: <PrintRoundedIcon />,
        title: "Aninda Mutfak Iletimi",
        text: "Siparisini onaylandigi anda mutfak yazicisina iletilir; sicak ve taze servis icin bekleme suresi minimumdur.",
    },
    {
        icon: <GroupsRoundedIcon />,
        title: "Ortak Masa Deneyimi",
        text: "Ayni masadaki herkes birbirinin secimini gorebilir ve siparisleri birlikte gondererek keyifli bir yemek deneyimi yasayabilir.",
    },
];

const values = [
    {
        icon: <BoltRoundedIcon />,
        title: "Hizli Servis",
        text: "Siparislerin taze, sicak ve zamaninda ulasmasi icin guclu bir servis akisi benimsiyoruz.",
    },
    {
        icon: <SecurityRoundedIcon />,
        title: "Guvenilir Kalite",
        text: "Malzeme secimindenunuma kadar her asamada kalite ve hijyen standardina onem veriyoruz.",
    },
    {
        icon: <DevicesRoundedIcon />,
        title: "Dijital Deneyim",
        text: "QR menu, anlik siparis takibi ve otomatik yazici entegrasyonuyla modern bir restoran deneyimi sunuyoruz.",
    },
    {
        icon: <TrendingUpRoundedIcon />,
        title: "Surekli Gelisim",
        text: "Daha iyi lezzet, daha iyi servis ve daha guclu misafir deneyimi icin kendimizi surekli gelistiriyoruz.",
    },
];

const stats = [
    { value: "Taze",   label: "Hamur & Malzeme" },
    { value: "Sicak",  label: "Servis Deneyimi" },
    { value: "Hizli",  label: "Siparis Iletimi" },
    { value: "Ozenli", label: "Hazirlik Sureci" },
];

const roadmap = [
    "Malzeme secimindenazirliga kadar kaliteyi her asamada on planda tutuyoruz.",
    "Siparisleri QR sistemi araciligiyla hizli, dogru ve duzenli sekilde aliyoruz.",
    "Sicak servis ve misafir memnuniyetini temel oncelik kabul ediyoruz.",
    "Lahmacun Sefasi deneyimini her gun daha da ileri tasimak icin kendimizi gelistiriyoruz.",
];

const missionItems = [
    "Kaliteli malzeme ile guclu lezzet sunmak",
    "QR siparis sistemiyle hizli ve hatasiz servis vermek",
    "Misafir memnuniyetini her zaman on planda tutmak",
    "Sicak, samimi ve guven veren bir ortam olusturmak",
];

const workingHours = [
    { gun: "Pazartesi",  saat: "09:00 - 22:30" },
    { gun: "Sali",       saat: "09:00 - 22:30" },
    { gun: "Carsamba",   saat: "09:00 - 22:30" },
    { gun: "Persembe",   saat: "09:00 - 22:30" },
    { gun: "Cuma",       saat: "09:00 - 22:30" },
    { gun: "Cumartesi",  saat: "09:00 - 22:30" },
    { gun: "Pazar",      saat: "09:00 - 22:30" },
];

// Alt bilesenler
function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
    return (
        <Stack spacing={1.25} sx={{ mb: 4 }}>
            <Chip
                label={eyebrow}
                sx={{ alignSelf: "flex-start", fontWeight: 800, bgcolor: brand.soft, color: brand.primary, borderRadius: 999 }}
            />
            <Typography sx={{ fontSize: { xs: 30, md: 42 }, lineHeight: 1.08, fontWeight: 950, color: brand.dark, maxWidth: 780 }}>
                {title}
            </Typography>
            {text && (
                <Typography sx={{ color: brand.muted, fontSize: { xs: 15, md: 17 }, lineHeight: 1.75, maxWidth: 760 }}>
                    {text}
                </Typography>
            )}
        </Stack>
    );
}

function GlassCard({ children }: { children: React.ReactNode }) {
    return (
        <Card
            elevation={0}
            sx={{
                height: "100%",
                borderRadius: 6,
                border: `1px solid ${brand.border}`,
                background: brand.card,
                backdropFilter: "blur(14px)",
                boxShadow: "0 20px 60px rgba(17,24,39,0.08)",
            }}
        >
            <CardContent sx={{ p: { xs: 2.25, md: 3 } }}>{children}</CardContent>
        </Card>
    );
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
    return (
        <GlassCard>
            <Stack spacing={2}>
                <Avatar sx={{ width: 56, height: 56, bgcolor: brand.soft, color: brand.primary, borderRadius: 3 }}>
                    {icon}
                </Avatar>
                <Typography sx={{ fontWeight: 900, fontSize: 20, color: brand.dark }}>{title}</Typography>
                <Typography sx={{ color: brand.muted, lineHeight: 1.75 }}>{text}</Typography>
            </Stack>
        </GlassCard>
    );
}

// AboutUs
export const AboutUs = () => {
    const navigate = useNavigate();

    const scrollToContact = useCallback(() => {
        document.getElementById("contact-section")?.scrollIntoView({ behavior: "smooth" });
    }, []);

    const handleGoHome = useCallback(() => navigate("/"), [navigate]);

    return (
        <Box
            sx={{
                minHeight: "100vh",
                bgcolor: "#FFFDFB",
                backgroundImage:
                    "radial-gradient(circle at top left, rgba(255,122,0,0.12), transparent 28%), radial-gradient(circle at top right, rgba(255,122,0,0.08), transparent 24%)",
            }}
        >
            <Container maxWidth="xl" sx={{ py: { xs: 6, md: 10 } }}>
                {/* Hero */}
                <Box
                    sx={{
                        position: "relative",
                        overflow: "hidden",
                        borderRadius: { xs: 6, md: 8 },
                        border: `1px solid ${brand.border}`,
                        background: "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(255,244,232,0.96))",
                        boxShadow: "0 30px 90px rgba(17,24,39,0.10)",
                        px: { xs: 2.5, md: 7 },
                        py: { xs: 4.5, md: 7 },
                    }}
                >
                    <Box sx={{ position: "absolute", right: -60, top: -60, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,122,0,0.18), rgba(255,122,0,0))" }} />

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.2fr 0.8fr" }, gap: { xs: 4, md: 5 }, alignItems: "center" }}>
                        <Stack spacing={3} sx={{ position: "relative", zIndex: 1 }}>
                            <Chip
                                icon={<WorkspacePremiumRoundedIcon />}
                                label="Lahmacun Sefasi'na hos geldiniz"
                                sx={{ alignSelf: "flex-start", bgcolor: brand.soft, color: brand.primary, fontWeight: 800, borderRadius: 999 }}
                            />
                            <Typography sx={{ fontSize: { xs: 34, md: 58 }, lineHeight: 1.02, fontWeight: 950, color: brand.dark, maxWidth: 760 }}>
                                Geleneksel lezzeti
                                <Box component="span" sx={{ color: brand.primary }}> dijital kolaylikla </Box>
                                bulustturan sicak bir Lahmacun Sefasi deneyimi sunuyoruz.
                            </Typography>
                            <Typography sx={{ color: brand.muted, fontSize: { xs: 16, md: 18 }, lineHeight: 1.8, maxWidth: 760 }}>
                                Lahmacun Sefasi olarak hedefimiz; kaliteli malzemeyi, ozenli hazarligi ve hizli
                                servisi bir araya getirerek misafirlerimize her zaman ayni lezzet standardini
                                sunmaktir.
                            </Typography>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                                <Button
                                    size="large"
                                    variant="contained"
                                    onClick={scrollToContact}
                                    sx={{ px: 3, py: 1.35, borderRadius: 999, fontWeight: 800, textTransform: "none", bgcolor: brand.primary, boxShadow: "none", "&:hover": { bgcolor: "#e96d00", boxShadow: "none" } }}
                                >
                                    Bize Ulasin
                                </Button>
                                <Button
                                    size="large"
                                    variant="outlined"
                                    onClick={handleGoHome}
                                    sx={{ px: 3, py: 1.35, borderRadius: 999, fontWeight: 800, textTransform: "none", borderColor: "rgba(17,24,39,0.12)", color: brand.dark }}
                                >
                                    Menumuzu Inceleyin
                                </Button>
                            </Stack>
                        </Stack>

                        <GlassCard>
                            <Stack spacing={2.5}>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Avatar sx={{ width: 58, height: 58, bgcolor: brand.primary, color: "white", borderRadius: 3 }}>
                                        <RestaurantMenuRoundedIcon />
                                    </Avatar>
                                    <Box>
                                        <Typography sx={{ fontWeight: 900, fontSize: 22, color: brand.dark }}>Lahmacun Sefasi Lezzeti</Typography>
                                        <Typography sx={{ color: brand.muted }}>Ozenle hazirlanan lahmacun, pide ve tatlilar - sicak servis ve samimi misafirperverlik.</Typography>
                                    </Box>
                                </Stack>

                                <Divider />

                                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5 }}>
                                    {stats.map((item) => (
                                        <Box key={item.label} sx={{ borderRadius: 4, p: 2, bgcolor: "rgba(255,255,255,0.88)", border: `1px solid ${brand.border}` }}>
                                            <Typography sx={{ fontSize: 24, fontWeight: 950, color: brand.primary }}>{item.value}</Typography>
                                            <Typography sx={{ color: brand.muted, fontSize: 14 }}>{item.label}</Typography>
                                        </Box>
                                    ))}
                                </Box>

                                <Box sx={{ borderRadius: 4, p: 2, bgcolor: "rgba(17,24,39,0.03)", border: `1px dashed ${brand.border}` }}>
                                    <Typography sx={{ color: brand.dark, fontWeight: 800, mb: 1 }}>Neden Lahmacun Sefasi?</Typography>
                                    <Typography sx={{ color: brand.muted, lineHeight: 1.75 }}>
                                        Cunku bizim icin iyi yemek sadece lezzetle sinirli degildir. Taze hamur, dogru
                                        ic malzeme, hizli servis ve misafir memnuniyeti bir araya geldiginde gercek kalite ortaya cikar.
                                    </Typography>
                                </Box>
                            </Stack>
                        </GlassCard>
                    </Box>
                </Box>

                {/* Features */}
                <Box sx={{ mt: { xs: 7, md: 10 } }}>
                    <SectionTitle
                        eyebrow="Bizi farkli kilan"
                        title="Lezzet, kalite ve dijital hizmet anlayisimizi her tabaga yansitiyoruz."
                        text="Misafirlerimize hem doyurucu hem de pratik bir yemek deneyimi sunmak icin ozenle calisiyoruz."
                    />
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
                        {features.map((item) => (
                            <FeatureCard key={item.title} icon={item.icon} title={item.title} text={item.text} />
                        ))}
                    </Box>
                </Box>

                {/* Story & How */}
                <Box sx={{ mt: { xs: 7, md: 10 } }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "0.95fr 1.05fr" }, gap: 2.5, alignItems: "stretch" }}>
                        <GlassCard>
                            <SectionTitle
                                eyebrow="Hikayemiz"
                                title="Lezzeti, kaliteyi ve teknolojiyi ayni sofrada bulusturmak."
                                text="Lahmacun Sefasi, misafirlerine sadece yemek sunan bir yer degil; sicak karsilamanin, kaliteli urunun ve akilli siparis sisteminin bir araya geldigi bir bulusma noktasi olmayihedefler."
                            />
                            <Stack spacing={2}>
                                {missionItems.map((text) => (
                                    <Stack key={text} direction="row" spacing={1.5} alignItems="flex-start">
                                        <CheckCircleRoundedIcon sx={{ color: brand.primary, mt: "2px" }} />
                                        <Typography sx={{ color: brand.dark, lineHeight: 1.7 }}>{text}</Typography>
                                    </Stack>
                                ))}
                            </Stack>
                        </GlassCard>

                        <GlassCard>
                            <SectionTitle
                                eyebrow="Nasil calisiyoruz"
                                title="Her siparisi ayni ozen ve dikkatle hazirliyoruz."
                                text="Mutfaktan servise kadar tum surecimizi duzen, hijyen, hiz ve kalite anlayisiyla yonetiyoruz."
                            />
                            <Stack spacing={2}>
                                {roadmap.map((step, index) => (
                                    <Box key={step} sx={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 1.5, alignItems: "start" }}>
                                        <Avatar sx={{ bgcolor: brand.soft, color: brand.primary, fontWeight: 900, width: 44, height: 44 }}>
                                            {index + 1}
                                        </Avatar>
                                        <Box sx={{ pt: 0.6 }}>
                                            <Typography sx={{ color: brand.dark, lineHeight: 1.7 }}>{step}</Typography>
                                        </Box>
                                    </Box>
                                ))}
                            </Stack>
                        </GlassCard>
                    </Box>
                </Box>

                {/* Values */}
                <Box sx={{ mt: { xs: 7, md: 10 } }}>
                    <SectionTitle
                        eyebrow="Degerlerimiz"
                        title="Yaptigimiz her isin merkezinde kalite, lezzet ve guven var."
                        text="Misafirlerimizin her ziyaretinde ayni memnuniyeti yasayabilmesi icin ozenli ve tutarli bir hizmet sunuyoruz."
                    />
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
                        {values.map((item) => (
                            <GlassCard key={item.title}>
                                <Stack spacing={1.75}>
                                    <Avatar sx={{ width: 52, height: 52, bgcolor: brand.soft, color: brand.primary, borderRadius: 3 }}>
                                        {item.icon}
                                    </Avatar>
                                    <Typography sx={{ fontWeight: 900, fontSize: 19, color: brand.dark }}>{item.title}</Typography>
                                    <Typography sx={{ color: brand.muted, lineHeight: 1.75 }}>{item.text}</Typography>
                                </Stack>
                            </GlassCard>
                        ))}
                    </Box>
                </Box>

                {/* Contact */}
                <Box id="contact-section" sx={{ mt: { xs: 7, md: 10 } }}>
                    <SectionTitle eyebrow="Bize Ulasin" title="Neredeyiz ve ne zaman acigiz?" />
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
                        <GlassCard>
                            <Stack spacing={1.5}>
                                <Typography sx={{ fontWeight: 900, fontSize: 16, color: brand.primary }}>Adres</Typography>
                                <Typography sx={{ color: brand.dark, lineHeight: 1.75 }}>Kirtepe, Koca Muftu Sk. 7A D:7A</Typography>
                                <Typography sx={{ color: brand.muted }}>74100 Bartin Merkez / Bartin, Turkiye</Typography>
                            </Stack>
                        </GlassCard>

                        <GlassCard>
                            <Stack spacing={1.5}>
                                <Typography sx={{ fontWeight: 900, fontSize: 16, color: brand.primary }}>Telefon</Typography>
                                <Typography
                                    component="a"
                                    href="tel:+903782288828"
                                    sx={{ color: brand.dark, fontWeight: 800, fontSize: 20, textDecoration: "none", "&:hover": { color: brand.primary } }}
                                >
                                    (0378) 228 88 28
                                </Typography>
                                <Typography sx={{ color: brand.muted, fontSize: 13 }}>Rezervasyon ve bilgi icin arayabilirsiniz.</Typography>
                            </Stack>
                        </GlassCard>

                        <GlassCard>
                            <Stack spacing={1.5}>
                                <Typography sx={{ fontWeight: 900, fontSize: 16, color: brand.primary }}>Calisma Saatleri</Typography>
                                {workingHours.map(({ gun, saat }) => (
                                    <Box
                                        key={gun}
                                        sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.25, borderBottom: `1px solid ${brand.border}`, "&:last-child": { borderBottom: "none" } }}
                                    >
                                        <Typography sx={{ color: brand.muted, fontSize: 13 }}>{gun}</Typography>
                                        <Typography sx={{ color: brand.dark, fontWeight: 700, fontSize: 13 }}>{saat}</Typography>
                                    </Box>
                                ))}
                            </Stack>
                        </GlassCard>
                    </Box>
                </Box>

                {/* CTA */}
                <Box sx={{ mt: { xs: 7, md: 10 } }}>
                    <GlassCard>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.1fr 0.9fr" }, gap: 3, alignItems: "center" }}>
                            <Stack spacing={2}>
                                <Chip
                                    icon={<RocketLaunchRoundedIcon />}
                                    label="Lahmacun Sefasi'ni kesfedin"
                                    sx={{ alignSelf: "flex-start", bgcolor: brand.soft, color: brand.primary, fontWeight: 800, borderRadius: 999 }}
                                />
                                <Typography sx={{ fontSize: { xs: 28, md: 40 }, lineHeight: 1.08, fontWeight: 950, color: brand.dark, maxWidth: 720 }}>
                                    Lahmacun Sefasi lezzetini ve sicak atmosferini yakindan kesfetmeye hazir misiniz?
                                </Typography>
                                <Typography sx={{ color: brand.muted, lineHeight: 1.8, maxWidth: 720 }}>
                                    Kaliteli urun, hizli QR siparis sistemi ve samimi yaklasimi bir arada sunan Lahmacun Sefasi'nda sizleri agirlamaktan memnuniyet duyariz.
                                </Typography>
                            </Stack>

                            <Stack spacing={1.5} alignItems={{ xs: "stretch", md: "flex-end" }}>
                                <Button
                                    size="large"
                                    variant="contained"
                                    component="a"
                                    href="tel:+903782288828"
                                    sx={{ minWidth: 220, px: 3, py: 1.35, borderRadius: 999, fontWeight: 800, textTransform: "none", bgcolor: brand.primary, boxShadow: "none", "&:hover": { bgcolor: "#e96d00", boxShadow: "none" } }}
                                >
                                    Hemen Ara
                                </Button>
                                <Button
                                    size="large"
                                    variant="text"
                                    onClick={handleGoHome}
                                    sx={{ minWidth: 220, px: 3, py: 1.2, borderRadius: 999, fontWeight: 800, textTransform: "none", color: brand.dark }}
                                >
                                    Menuyu Gor
                                </Button>
                            </Stack>
                        </Box>
                    </GlassCard>
                </Box>
            </Container>
        </Box>
    );
};