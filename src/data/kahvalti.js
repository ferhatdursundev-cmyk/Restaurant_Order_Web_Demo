const hamburgerkahvalti = {
    "kahvalti": {
        id: 12321412312312,
        isAvailable: true,
        keyTitle: "kahvalti",
        title: "Kahvalti",
        type: "eat",
        price: 100,
        image: "https://firebasestorage.googleapis.com/v0/b/restaurantorderwebdemo.firebasestorage.app/o/Kahvalti.jpg?alt=media&token=1094a3b7-3868-48fe-b8e0-547aa9636999",
        description: "",
        allergens: ["4", "Aa", "C", "F", "G", "H", "I"],
        optionsCatalog: {},
        translations: {
            tr: { title: "Kahvaltı", description: "" },
            de: { title: "Frühstück", description: "" },
            en: { title: "Breakfast", description: "" },
            ru: { title: "Завтрак", description: "" },
        },
    },
};

const newFetchData = async () => {
    await set(ref(db, "menu/kahvalti"), hamburger);
};
useEffect(() => {
    newFetchData()
}, []);