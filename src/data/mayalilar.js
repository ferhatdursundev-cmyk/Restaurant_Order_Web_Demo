
const mayalilar = {
    "kruvasanSandwich": {
        id: 3001,
        isAvailable: true,
        keyTitle: "kruvasanSandwich",
        title: "kruvasanSandwich",
        type: "eat",
        price: 150,
        image: "https://firebasestorage.googleapis.com/v0/b/restaurant-app-project-fbf8c.firebasestorage.app/o/menu-images%2Fbaguette%2F04_Baguette_Salami.jpg?alt=media&token=16c608f8-3156-421d-a406-9962908960ca",
        description: "",
        allergens: ["A", "C"],
        optionsCatalog: {
            salata: [
                {id: 0, key: "domates", label: "Domates"},
                {id: 1, key: "salatalik", label: "Salatalik"},
                {id: 2, key: "marul", label: "Marul"},
                {id: 3, key: "sogan", label: "Sogan"},
            ],
            sos: [
                {id: 11, label: "Aci", price: null},
                {id: 12, label: "Cacik", price: null},
                {id: 13, label: "Ketcap", price: null},
                {id: 14, label: "Mayonez", price: null},
            ],
        },
        translations: {
            tr: { title: "Kruvasanlı Sandviç", description: "" },
            de: { title: "Croissant-Sandwich", description: "" },
            en: { title: "Croissant Sandwich", description: "" },
            ru: { title: "Круассан-сэндвич", description: "" },
        },
    },
    "sandwichBeyazPeynir": {
        id: 3002,
        isAvailable: true,
        keyTitle: "sandwichBeyazPeynir",
        title: "sandwichBeyazPeynir",
        type: "eat",
        price: 70,
        image: "https://firebasestorage.googleapis.com/v0/b/restaurant-app-project-fbf8c.firebasestorage.app/o/menu-images%2Fbaguette%2F04_Baguette_Salami.jpg?alt=media&token=16c608f8-3156-421d-a406-9962908960ca",
        description: "",
        allergens: ["A", "C"],
        optionsCatalog: {
            salata: [
                {id: 0, key: "domates", label: "Domates"},
                {id: 1, key: "salatalik", label: "Salatalik"},
                {id: 2, key: "marul", label: "Marul"},
                {id: 3, key: "sogan", label: "Sogan"},
            ],
            sos: [
                {id: 11, label: "Aci", price: null},
                {id: 12, label: "Cacik", price: null},
                {id: 13, label: "Ketcap", price: null},
                {id: 14, label: "Mayonez", price: null},
            ],
        },
        translations: {
            tr: { title: "Beyaz Peynirli Sandviç", description: "" },
            de: { title: "Sandwich mit Weißkäse", description: "" },
            en: { title: "White Cheese Sandwich", description: "" },
            ru: { title: "Сэндвич с белым сыром", description: "" },
        },
    },
    "sandwichSalamKasar": {
        id: 3003,
        isAvailable: true,
        keyTitle: "sandwichSalamKasar",
        title: "sandwichSalamKasar",
        type: "eat",
        price: 75,
        image: "https://firebasestorage.googleapis.com/v0/b/restaurant-app-project-fbf8c.firebasestorage.app/o/menu-images%2Fbaguette%2F04_Baguette_Salami.jpg?alt=media&token=16c608f8-3156-421d-a406-9962908960ca",
        description: "",
        allergens: ["A", "C"],
        optionsCatalog: {
            salata: [
                {id: 0, key: "domates", label: "Domates"},
                {id: 1, key: "salatalik", label: "Salatalik"},
                {id: 2, key: "marul", label: "Marul"},
                {id: 3, key: "sogan", label: "Sogan"},
            ],
            sos: [
                {id: 11, label: "Aci", price: null},
                {id: 12, label: "Cacik", price: null},
                {id: 13, label: "Ketcap", price: null},
                {id: 14, label: "Mayonez", price: null},
            ],
        },
        translations: {
            tr: { title: "Salamilı Kaşarlı Sandviç", description: "" },
            de: { title: "Sandwich mit Salami und Kashkaval", description: "" },
            en: { title: "Salami and Kashkaval Sandwich", description: "" },
            ru: { title: "Сэндвич с салями и кашкавалом", description: "" },
        },
    },
    "cavdarliSandwich": {
        id: 3004,
        isAvailable: true,
        keyTitle: "cavdarliSandwich",
        title: "cavdarliSandwich",
        type: "eat",
        price: 90,
        image: "https://firebasestorage.googleapis.com/v0/b/restaurant-app-project-fbf8c.firebasestorage.app/o/menu-images%2Fbaguette%2F04_Baguette_Salami.jpg?alt=media&token=16c608f8-3156-421d-a406-9962908960ca",
        description: "",
        allergens: ["A", "C"],
        optionsCatalog: {
            salata: [
                {id: 0, key: "domates", label: "Domates"},
                {id: 1, key: "salatalik", label: "Salatalik"},
                {id: 2, key: "marul", label: "Marul"},
                {id: 3, key: "sogan", label: "Sogan"},
            ],
            sos: [
                {id: 11, label: "Aci", price: null},
                {id: 12, label: "Cacik", price: null},
                {id: 13, label: "Ketcap", price: null},
                {id: 14, label: "Mayonez", price: null},
            ],
        },
        translations: {
            tr: { title: "Çavdarlı Sandviç", description: "" },
            de: { title: "Roggenbrot-Sandwich", description: "" },
            en: { title: "Rye Bread Sandwich", description: "" },
            ru: { title: "Сэндвич на ржаном хлебе", description: "" },
        },
    },
};

const newFetchData = async () => {
    await set(ref(db, "menu/mayalilar"), mayalilar);
};
useEffect(() => {
    newFetchData()
}, []);