const baslangiclar = {
    "meze": {
        id: 607,
        isAvailable: true,
        keyTitle: "meze",
        title: "Meze",
        type: "eat",
        price: 100,
        image: "https://firebasestorage.googleapis.com/v0/b/restaurantorderwebdemo.firebasestorage.app/o/meze.jpg?alt=media&token=a65931e5-1cbe-4441-b6ff-9e4d5093cfb3",
        description: "",
        allergens: ["4", "Aa", "C", "F", "G", "H", "I"],
        optionsCatalog: {},
        translations: {
            tr: { title: "Meze", description: "" },
            de: { title: "Vorspeise", description: "" },
            en: { title: "Appetizer", description: "" },
            ru: { title: "Закуска", description: "" },
        },
    },
};

//const newFetchData = async () => {
//    await set(ref(db, "menu/baslangiclar"), baslangiclar);
//};
//useEffect(() => {
//    newFetchData()
//}, []);