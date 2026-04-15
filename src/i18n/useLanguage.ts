import { createContext, useContext, useState, useCallback, type ReactNode, createElement } from "react";

export type Lang = "de" | "tr" | "ru" | "en";

export const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
    { code: "de", label: "Deutsch", flag: "🇩🇪" },
    { code: "tr", label: "Türkçe", flag: "🇹🇷" },
    { code: "ru", label: "Русский", flag: "🇷🇺" },
    { code: "en", label: "English", flag: "🇬🇧" },
];

// translations

export type Translations = typeof de;

const de = {
    // Menu UI
    menu: {
        outOfStock: "Ausverkauft",
        noImage: "Kein Bild",
        noAllergen: "Kein Allergen",
        allergyInfo: "Allergie",
        addToCart: "In den Warenkorb",
        noItems: "Keine Produkte in dieser Kategorie.",
        locationChecking: "Standort wird überprüft...",
        locationError: "Für die Bestellung wird eine Standortgenehmigung benötigt. Bitte aktivieren Sie den Standortzugriff in den Browsereinstellungen.",
        locationDenied: "Sie müssen sich am Tisch befinden, an dem Sie den QR-Code gescannt haben, um bestellen zu können!",
        menuError: "Menü konnte nicht geladen werden",
        updatePrice: "Preis aktualisieren",
        newPrice: "Neuer Preis (TL)",
        save: "Speichern",
        cancel: "Abbrechen",
        invalidPrice: "Bitte einen gültigen Preis eingeben.",
        priceUpdated: "Preis aktualisiert.",
        priceUpdateError: "Preis konnte nicht aktualisiert werden. Berechtigungsfehler.",
        allergyDialogTitle: "Allergieinformation",
        allergyNotFound: "Keine Beschreibung für diesen Allergen gefunden.",
        cartCount: (n: number) => `${n} Produkt${n !== 1 ? "e" : ""}`,
        goToCart: "Zum Warenkorb",
        addedToCart: (title: string) => `${title} wurde in den Warenkorb gelegt`,
        available: "verfügbar",
        outOfStockNotify: "ausverkauft",
        categories: {
            corbalar: "Suppen",
            baslangiclar: "Vorspeisen",
            lahmacun: "Lahmacun",
            pide: "Pide",
            vegan: "Vegan",
            vejetaryen: "Vegetarisch",
            diyet: "Diät",
            alkollu_icecekler: "Alkoholische Getränke",
            salatalar: "Salate",
            tatlilar: "Desserts",
            icecekler: "Getränke",
            izgaralar: "Grillgerichte",
            balik: "Fisch & Meeresfrüchte",
            kahvalti: "Frühstück",
            hamburger: "Hamburger",
            makarna: "Pasta",
            sutlu_tatlilar: "Milchdesserts",
            serbetli_tatlilar: "Desserts mit Sirup",
            pasta: "Kuchen & Torten",
            dondurma: "Eis",
            meyve_sulari: "Fruchtsäfte",
            caylar: "Tees",
            sicak_icecekler: "Warme Getränke",
        }
    },
    // Basket UI
    basket: {
        title: "Warenkorb",
        yourItems: "Deine Auswahl",
        othersItems: "Auswahl der anderen Personen am selben Tisch",
        note: "Notiz:",
        notePlaceholder: "Z.B.: ohne Zwiebeln, ohne Petersilie, nicht scharf...",
        noNote: "Keine Notiz",
        total: "Gesamt",
        table: "Tisch",
        tableNotFound: "Kein Tisch gefunden",
        email: "E-Mail",
        emailPlaceholder: "name@example.com",
        emailHelper: "Die Bestellinformation wird an diese E-Mail-Adresse gesendet.",
        emailError: "Bitte eine gültige E-Mail-Adresse eingeben.",
        sendOrder: "Bestellung absenden",
        confirmTitle: "Möchten Sie Ihre und die Bestellungen der anderen Personen am Tisch absenden?",
        confirmTitleHighlight: "der anderen Personen am Tisch",
        confirmDesc: (total: number) => `Gesamtbetrag: ${total} TL`,
        confirmYes: "Ja, absenden",
        confirmNo: "Abbrechen",
        locationWarning: "Sie müssen sich im Restaurant befinden, um eine Bestellung aufzugeben.",
        orderSent: "Bestellung gesendet.",
        orderSentEmail: "Bestellung gesendet. E-Mail-Benachrichtigung wird vorbereitet.",
        orderError: "Bestellung konnte nicht gesendet werden",
        tokenExpired: "Token abgelaufen. Bitte QR-Code erneut scannen.",
        tokenMissing: "Token nicht gefunden oder abgelaufen. Bitte QR-Code erneut scannen.",
        qrExpired: "QR-Code abgelaufen. Bitte erneut scannen.",
        noTableSelected: "Bitte Tisch auswählen.",
        counterError: "Bestellnummer konnte nicht generiert werden",
        removedFromCart: (title: string) => `${title} wurde aus dem Warenkorb entfernt.`,
    },
    header: {
        login: "Login",
        aboutUs: "Über uns",
        back: "Zurück",
        account: "Konto",
        tables: "Tische",
        staff: "Personal",
        report: "Bericht",
        package: "Paket",
        logout: "Logout",
        sentOrders: "An die Kasse gesendete Bestellungen",
    },
};

const tr: Translations = {
    menu: {
        outOfStock: "Tükendi",
        noImage: "Görsel yok",
        noAllergen: "Alerjen yok",
        allergyInfo: "Alerji",
        addToCart: "Sepete ekle",
        noItems: "Bu kategoride ürün yok.",
        locationChecking: "Konum kontrol ediliyor...",
        locationError: "Sipariş verebilmek için konum iznine ihtiyaç var. Lütfen tarayıcı ayarlarından konum iznini verin.",
        locationDenied: "Sipariş verebilmek için QR kodu okuttuğunuz masada olmanız gerekmektedir!",
        menuError: "Menü okunamadı",
        updatePrice: "Fiyatı Güncelle",
        newPrice: "Yeni Fiyat (₺)",
        save: "Kaydet",
        cancel: "İptal",
        invalidPrice: "Geçerli bir fiyat girin.",
        priceUpdated: "Fiyat güncellendi.",
        priceUpdateError: "Fiyat güncellenemedi. Yetki hatası.",
        allergyDialogTitle: "Alerji Bilgisi",
        allergyNotFound: "Bu alerji için açıklama bulunamadı.",
        cartCount: (n: number) => `${n} ürün`,
        goToCart: "Sepete Git",
        addedToCart: (title: string) => `${title} sepete eklendi`,
        available: "mevcut",
        outOfStockNotify: "tükendi",
        categories: {
            corbalar: "Çorbalar",
            baslangiclar: "Başlangıçlar",
            lahmacun: "Lahmacun",
            pide: "Pide",
            vegan: "Vegan",
            vejetaryen: "Vejetaryen",
            diyet: "Diyet",
            alkollu_icecekler: "Alkollü İçecekler",
            salatalar: "Salatalar",
            tatlilar: "Tatlılar",
            icecekler: "İçecekler",
            izgaralar: "Izgaralar",
            balik: "Balık & Deniz Ürünleri",
            kahvalti: "Kahvaltı",
            hamburger: "Hamburger",
            makarna: "Makarna",
            sutlu_tatlilar: "Sütlü Tatlılar",
            serbetli_tatlilar: "Şerbetli Tatlılar",
            pasta: "Pasta",
            dondurma: "Dondurma",
            meyve_sulari: "Meyve Suları",
            caylar: "Çaylar",
            sicak_icecekler: "Sıcak İçecekler",
        }
    },
    basket: {
        title: "Sepet",
        yourItems: "Senin seçtiklerin",
        othersItems: "Aynı masadaki diğer kişilerin seçtikleri",
        note: "Not:",
        notePlaceholder: "Örn: soğansız, maydonozsuz, acısız...",
        noNote: "Not yok",
        total: "Toplam",
        table: "Masa",
        tableNotFound: "Masa bulunamadı",
        email: "E-Mail",
        emailPlaceholder: "name@example.com",
        emailHelper: "Sipariş bilgisi bu e-mail adresine gönderilecek.",
        emailError: "Lütfen geçerli bir e-mail adresi girin.",
        sendOrder: "Siparişi Gönder",
        confirmTitle: "Sizin ve diğerlerinin seçtiği siparişleri göndermek istiyor musunuz?",
        confirmTitleHighlight: "ve diğerlerinin seçtiği",
        confirmDesc: (total: number) => `Toplam tutar: ${total} TL`,
        confirmYes: "Evet, gönder",
        confirmNo: "Vazgeç",
        locationWarning: "Sipariş göndermek için restoranda olmanız gerekiyor.",
        orderSent: "Sipariş gönderildi.",
        orderSentEmail: "Sipariş gönderildi. E-mail bilgilendirmesi hazırlanıyor.",
        orderError: "Sipariş gönderilemedi",
        tokenExpired: "Token süresi doldu. Lütfen bu sayfayi kapatin ve QR kodu tekrar okutun.",
        tokenMissing: "Token bulunamadı veya süresi dolmuş olabilir. Lütfen bu sayfayi kapatin ve QR kodu tekrar okutun.",
        qrExpired: "QR Kodun süresi doldu. Lütfen bu sayfayi kapatin ve QR Kodu tekrar okutun.",
        noTableSelected: "Lütfen masa seçin.",
        counterError: "Sipariş numarası üretilemedi",
        removedFromCart: (title: string) => `${title} sepetten çıkarıldı.`,
    },
    header: {
        login: "Giriş",
        aboutUs: "Hakkımızda",
        back: "Geri",
        account: "Hesap",
        tables: "Masalar",
        staff: "Personel",
        report: "Rapor",
        package: "Paket",
        logout: "Çıkış",
        sentOrders: "Kasaya Gönderilen Siparişler",
    },
};

const ru: Translations = {
    menu: {
        outOfStock: "Нет в наличии",
        noImage: "Нет фото",
        noAllergen: "Без аллергенов",
        allergyInfo: "Аллергия",
        addToCart: "В корзину",
        noItems: "В этой категории нет продуктов.",
        locationChecking: "Проверка местоположения...",
        locationError: "Для заказа необходимо разрешение на местоположение. Пожалуйста, разрешите доступ к местоположению в настройках браузера.",
        locationDenied: "Для заказа вы должны находиться за столиком, где был отсканирован QR-код!",
        menuError: "Не удалось загрузить меню",
        updatePrice: "Обновить цену",
        newPrice: "Новая цена (TL)",
        save: "Сохранить",
        cancel: "Отмена",
        invalidPrice: "Введите действительную цену.",
        priceUpdated: "Цена обновлена.",
        priceUpdateError: "Не удалось обновить цену. Ошибка доступа.",
        allergyDialogTitle: "Информация об аллергенах",
        allergyNotFound: "Описание для этого аллергена не найдено.",
        cartCount: (n: number) => `${n} товар${n > 1 ? "а" : ""}`,
        goToCart: "В корзину",
        addedToCart: (title: string) => `${title} добавлен в корзину`,
        available: "в наличии",
        outOfStockNotify: "нет в наличии",
        categories: {
            corbalar: "Супы",
            baslangiclar: "Закуски",
            lahmacun: "Лахмаджун",
            pide: "Пиде",
            vegan: "Веганское",
            vejetaryen: "Вегетарианское",
            diyet: "Диетическое",
            alkollu_icecekler: "Алкогольные напитки",
            salatalar: "Салаты",
            tatlilar: "Десерты",
            icecekler: "Напитки",
            izgaralar: "Блюда на гриле",
            balik: "Рыба и морепродукты",
            kahvalti: "Завтрак",
            hamburger: "Бургеры",
            makarna: "Паста",
            sutlu_tatlilar: "Молочные десерты",
            serbetli_tatlilar: "Сиропные десерты",
            pasta: "Торты и пирожные",
            dondurma: "Мороженое",
            meyve_sulari: "Фруктовые соки",
            caylar: "Чаи",
            sicak_icecekler: "Горячие напитки",
        }
    },
    basket: {
        title: "Корзина",
        yourItems: "Ваш выбор",
        othersItems: "Выбор других людей за этим столиком",
        note: "Заметка:",
        notePlaceholder: "Напр.: без лука, без петрушки, без острого...",
        noNote: "Нет заметки",
        total: "Итого",
        table: "Стол",
        tableNotFound: "Стол не найден",
        email: "E-Mail",
        emailPlaceholder: "name@example.com",
        emailHelper: "Информация о заказе будет отправлена на этот адрес.",
        emailError: "Пожалуйста, введите действительный адрес электронной почты.",
        sendOrder: "Отправить заказ",
        confirmTitle: "Вы хотите отправить ваш заказ и заказы других людей за столиком?",
        confirmTitleHighlight: "других людей за столиком",
        confirmDesc: (total: number) => `Итоговая сумма: ${total} TL`,
        confirmYes: "Да, отправить",
        confirmNo: "Отмена",
        locationWarning: "Для отправки заказа вы должны находиться в ресторане.",
        orderSent: "Заказ отправлен.",
        orderSentEmail: "Заказ отправлен. Подготовка уведомления по электронной почте.",
        orderError: "Не удалось отправить заказ",
        tokenExpired: "Срок действия токена истёк. Пожалуйста, отсканируйте QR-код ещё раз.",
        tokenMissing: "Токен не найден или истёк. Пожалуйста, отсканируйте QR-код ещё раз.",
        qrExpired: "Срок действия QR-кода истёк. Отсканируйте QR-код ещё раз.",
        noTableSelected: "Пожалуйста, выберите стол.",
        counterError: "Не удалось сгенерировать номер заказа",
        removedFromCart: (title: string) => `${title} удалён из корзины.`,
    },
    header: {
        login: "Войти",
        aboutUs: "О нас",
        back: "Назад",
        account: "Аккаунт",
        tables: "Столики",
        staff: "Персонал",
        report: "Отчёт",
        package: "Навынос",
        logout: "Выйти",
        sentOrders: "Заказы, отправленные на кассу",
    },
};

const en: Translations = {
    menu: {
        outOfStock: "Out of Stock",
        noImage: "No Image",
        noAllergen: "No allergens",
        allergyInfo: "Allergy",
        addToCart: "Add to cart",
        noItems: "No products in this category.",
        locationChecking: "Checking location...",
        locationError: "Location permission is required to order. Please enable location access in your browser settings.",
        locationDenied: "You must be at the table where you scanned the QR code to place an order!",
        menuError: "Could not load menu",
        updatePrice: "Update Price",
        newPrice: "New Price (TL)",
        save: "Save",
        cancel: "Cancel",
        invalidPrice: "Please enter a valid price.",
        priceUpdated: "Price updated.",
        priceUpdateError: "Could not update price. Permission error.",
        allergyDialogTitle: "Allergy Information",
        allergyNotFound: "No description found for this allergen.",
        cartCount: (n: number) => `${n} item${n !== 1 ? "s" : ""}`,
        goToCart: "Go to Cart",
        addedToCart: (title: string) => `${title} added to cart`,
        available: "available",
        outOfStockNotify: "out of stock",
        categories: {
            corbalar: "Soups",
            baslangiclar: "Appetizers",
            lahmacun: "Lahmacun",
            pide: "Pide",
            vegan: "Vegan",
            vejetaryen: "Vegetarian",
            diyet: "Diet",
            alkollu_icecekler: "Alcoholic Beverages",
            salatalar: "Salads",
            tatlilar: "Desserts",
            icecekler: "Beverages",
            izgaralar: "Grilled Dishes",
            balik: "Fish & Seafood",
            kahvalti: "Breakfast",
            hamburger: "Burgers",
            makarna: "Pasta",
            sutlu_tatlilar: "Milk-Based Desserts",
            serbetli_tatlilar: "Syrup-Based Desserts",
            pasta: "Cakes",
            dondurma: "Ice Cream",
            meyve_sulari: "Fruit Juices",
            caylar: "Teas",
            sicak_icecekler: "Hot Drinks",
        }
    },
    basket: {
        title: "Cart",
        yourItems: "Your selection",
        othersItems: "Selection of other people at the same table",
        note: "Note:",
        notePlaceholder: "E.g.: no onions, no parsley, not spicy...",
        noNote: "No note",
        total: "Total",
        table: "Table",
        tableNotFound: "No table found",
        email: "E-Mail",
        emailPlaceholder: "name@example.com",
        emailHelper: "Order information will be sent to this email address.",
        emailError: "Please enter a valid email address.",
        sendOrder: "Send Order",
        confirmTitle: "Do you want to send your order and the orders of the others at the table?",
        confirmTitleHighlight: "the others at the table",
        confirmDesc: (total: number) => `Total amount: ${total} TL`,
        confirmYes: "Yes, send",
        confirmNo: "Cancel",
        locationWarning: "You must be in the restaurant to place an order.",
        orderSent: "Order sent.",
        orderSentEmail: "Order sent. Email notification is being prepared.",
        orderError: "Could not send order",
        tokenExpired: "Token expired. Please scan the QR code again.",
        tokenMissing: "Token not found or expired. Please scan the QR code again.",
        qrExpired: "QR code expired. Please scan again.",
        noTableSelected: "Please select a table.",
        counterError: "Could not generate order number",
        removedFromCart: (title: string) => `${title} removed from cart.`,
    },
    header: {
        login: "Login",
        aboutUs: "About Us",
        back: "Back",
        account: "Account",
        tables: "Tables",
        staff: "Staff",
        report: "Report",
        package: "Takeaway",
        logout: "Logout",
        sentOrders: "Orders Sent to Checkout",
    },
};

export const TRANSLATION_MAP: Record<Lang, Translations> = { de, tr, ru, en };

// ─── Context ─────────────────────────────────────────────────────────────────

interface LanguageContextValue {
    lang: Lang;
    setLang: (l: Lang) => void;
    t: Translations;
}

const LanguageContext = createContext<LanguageContextValue>({
    lang: "de",
    setLang: () => {},
    t: de,
});

const STORAGE_KEY = "app_lang";

function detectInitialLang(): Lang {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored && stored in TRANSLATION_MAP) return stored;

    const browser = navigator.language.split("-")[0] as Lang;
    if (browser in TRANSLATION_MAP) return browser;

    return "tr";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Lang>(detectInitialLang);

    const setLang = useCallback((l: Lang) => {
        localStorage.setItem(STORAGE_KEY, l);
        setLangState(l);
    }, []);

    return createElement(
        LanguageContext.Provider,
        { value: { lang, setLang, t: TRANSLATION_MAP[lang] } },
        children
    );
}

export function useLanguage() {
    return useContext(LanguageContext);
}

// ─── Helper: get localized field from a menu item ────────────────────────────

export type ItemTranslations = {
    title?: string;
    description?: string;
};

export function getLocalizedField(
    item: { title?: string; description?: string; translations?: Record<string, ItemTranslations> },
    field: keyof ItemTranslations,
    lang: Lang,
): string {
    const fromTranslations = item.translations?.[lang]?.[field];
    if (fromTranslations) return fromTranslations;

    // fallback chain: de → item root field
    const fromDe = item.translations?.["de"]?.[field];
    if (fromDe) return fromDe;

    return (item[field] as string | undefined) ?? "";
}