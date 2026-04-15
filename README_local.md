# Restaurant Order Web — Yazıcı Ajanı (Print Agent)

## Genel Bakış

Bu proje, Firebase Realtime Database üzerindeki siparişleri dinleyerek bağlı ağ yazıcısına otomatik yazdırma işlemi gerçekleştiren bir Node.js ajanı içermektedir. Ajanın çalışabilmesi için aşağıdaki adımların eksiksiz tamamlanması gerekmektedir.

---

## Gereksinimler

- **Node.js** v18 veya üzeri
- Ağa bağlı bir **termal veya ağ yazıcısı** (TCP/IP destekli, varsayılan port: 9100)
- Firebase projesine erişim yetkisi
- `agent.js` dosyasının ilgili dizinde mevcut olması

---

## Kurulum

### 1. Bağımlılıkları Yükle

Proje dizininde terminal açarak aşağıdaki komutu çalıştır:

```bash
npm install
```

---

## Yazıcı Ajanını Başlatma

Ajan, `start-agent.sh` adlı bash betiği ile başlatılır. Bu betik; Firebase bağlantı adresini, yazıcı IP'sini ve portunu ortam değişkeni olarak tanımlayıp `agent.js`'i çalıştırır.

### Betik İçeriği (`start-agent.sh`)

```bash
#!/bin/bash
cd "$(dirname "$0")"
RTDB_URL="https://restaurantorderweb-default-rtdb.europe-west1.firebasedatabase.app/" \
PRINTER_IP="192.168.0.115" \
PRINTER_PORT="9100" \
node agent.js
```

### Ortam Değişkenleri

| Değişken       | Açıklama                                              | Örnek Değer                                                                 |
|----------------|-------------------------------------------------------|-----------------------------------------------------------------------------|
| `RTDB_URL`     | Firebase Realtime Database bağlantı adresi            | `https://restaurantorderweb-default-rtdb.europe-west1.firebasedatabase.app/` |
| `PRINTER_IP`   | Ağ yazıcısının yerel IP adresi (varsayılan: `192.168.0.115`) | `192.168.0.115`                                                       |
| `PRINTER_PORT` | Yazıcının dinlediği TCP portu (genellikle 9100)       | `9100`                                                                      |

> **Not:** Yazıcının IP adresi veya portu değişirse bu betikteki değerleri güncellemeyi unutma.

---

## Betiği Çalıştırılabilir Yapma

Betiği ilk kez çalıştırmadan önce çalıştırma izni ver:

```bash
chmod +x start-agent.sh
```

---

## Ajanı Başlatma

```bash
./start-agent.sh
```

Terminal çıktısında Firebase bağlantısının kurulduğuna ve yazıcının erişilebilir olduğuna dair mesajlar görünmelidir.

---

## Sık Yapılan Hata: Ajanı Başlatmayı Unutmak

Yazıcıdan çıktı alınamıyorsa yapılacak **ilk kontrol** ajanın çalışıp çalışmadığıdır.

Ajan çalışmadan:
- Siparişler Firebase'e yazılır ✅
- Yazıcıya hiçbir veri gönderilmez ❌
- Ekranda herhangi bir hata mesajı görünmez ❌

Bu nedenle sunucu veya kasa bilgisayarı her yeniden başlatıldığında ajanın tekrar çalıştırılması gerekir.

---

## Yazıcı IP Adresini Değiştirme

Varsayılan yazıcı IP adresi `192.168.0.115` olarak ayarlanmıştır. Yazıcının IP adresi değişirse aşağıdaki iki yerde güncelleme yapman gerekir:

### 1. `start-agent.sh` dosyasında

```bash
PRINTER_IP="192.168.0.115" \   # ← burası
```

Yeni IP adresiyle güncelle:

```bash
PRINTER_IP="192.168.0.YENİ_IP" \
```

### 2. `agent.js` dosyasında (eğer sabit tanımlıysa)

`agent.js` içinde aşağıdaki gibi bir satır bulunabilir:

```js
const PRINTER_IP = process.env.PRINTER_IP || "192.168.0.115";
const PRINTER_PORT = parseInt(process.env.PRINTER_PORT || "9100");
```

Eğer `process.env.PRINTER_IP` kullanılıyorsa `start-agent.sh` içindeki değeri güncellemek yeterlidir. Ancak `agent.js` içinde IP adresi doğrudan sabit olarak yazılmışsa orada da güncelleme yapman gerekir.

> **İpucu:** Yazıcının IP adresinin değişmemesi için router/modem ayarlarından yazıcıya **statik IP** (sabit IP) tanımlamanı öneririz. Böylece her seferinde güncelleme yapman gerekmez.

---

## Ajanın Arka Planda Çalışması (Opsiyonel)

Ajanın terminal kapatılsa bile çalışmaya devam etmesi için `pm2` kullanılabilir:

```bash
# pm2'yi global olarak yükle
npm install -g pm2

# Ajanı pm2 ile başlat
pm2 start start-agent.sh --name print-agent

# Sistem yeniden başladığında otomatik başlaması için
pm2 startup
pm2 save
```

Durum kontrolü:

```bash
pm2 status
pm2 logs print-agent
```

Durdurmak için:

```bash
pm2 stop print-agent
```

---

## Sorun Giderme

| Sorun | Olası Neden | Çözüm |
|-------|-------------|-------|
| Yazıcıdan çıktı gelmiyor | Ajan çalışmıyor | `./start-agent.sh` ile başlat |
| Bağlantı hatası | Yazıcı IP değişmiş | `start-agent.sh` içindeki `PRINTER_IP` değerini güncelle |
| Firebase hatası | RTDB URL yanlış | `RTDB_URL` değerini kontrol et |
| `permission denied` hatası | Betik çalıştırma izni yok | `chmod +x start-agent.sh` çalıştır |
