{/*
const now = new Date().toISOString();

const tables: Record<string, unknown> = {};
for (let i = 1; i <= 10; i++) {
    const id = `t${i}`;
    tables[id] = {
        id,
        number: i,
        name: `Masa ${i}`,
        isOpen: false,
        activeOrderId: null,
        createdAt: now,
        updatedAt: now,
    };
}

// ✅ Seçenek 1: Var olanı tamamen değiştirir (tables node'unu overwrite eder)
// await set(ref(db, "tables"), tables);

// ✅ Seçenek 2 (önerilen): Sadece t1..t10'u yazar/merge eder (mevcut diğer table'lara dokunmaz)
update(ref(db, "tables"), tables);

*/}