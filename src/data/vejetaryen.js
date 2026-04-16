const vejetaryen = {
    "vejetaryen": {
        id: 907,
        isAvailable: true,
        keyTitle: "Vejeteryan",
        title: "Vejeteryan",
        type: "eat",
        price: 100,
        image: "https://firebasestorage.googleapis.com/v0/b/restaurantorderwebdemo.firebasestorage.app/o/vegan.jpg?alt=media&token=cb7ce100-f54c-4f25-af78-5b152708acd2",
        description: "",
        allergens: ["4", "Aa", "C", "F", "G", "H", "I"],
        optionsCatalog: {},
        translations: {
            tr: { title: "Vejetaryen", description: "" },
            de: { title: "Vegetarisch", description: "" },
            en: { title: "Vegetarian", description: "" },
            ru: { title: "Вегетарианское", description: "" },
        },
    },
};

//const newFetchData = async () => {
//    await set(ref(db, "menu/vejetaryen"), vejetaryen);
//};
//useEffect(() => {
//    newFetchData()
//}, []);