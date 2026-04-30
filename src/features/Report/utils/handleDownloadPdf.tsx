import dayjs, { Dayjs } from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ProductRow = {
    productId: string;
    title: string;
    qty: number;
    revenue: number;
};

export type TimePoint = {
    label: string;
    revenue: number;
    qty: number;
};

export type ReportResponse = {
    fromISO: string;
    toISO: string;
    totalRevenue: number;
    totalQty: number;
    orderCount: number;
    topProduct?: { title: string; qty: number; revenue: number };
    byProduct: ProductRow[];
    series: TimePoint[];
};

type JsPdfWithTable = jsPDF & {
    lastAutoTable?: { finalY: number };
};

// Pure helpers
function eur(n: number) {
    return (
        new Intl.NumberFormat("tr-TR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(n) + " TL"
    );
}

function normalizeTurkish(str: string): string {
    return str
        .replace(/I/g, "I").replace(/i/g, "i")
        .replace(/S/g, "S").replace(/s/g, "s")
        .replace(/G/g, "G").replace(/g/g, "g")
        .replace(/U/g, "U").replace(/u/g, "u")
        .replace(/O/g, "O").replace(/o/g, "o")
        .replace(/C/g, "C").replace(/c/g, "c");
}

export const handleDownloadPdf = async (
    data: ReportResponse,
    rangeFrom: Dayjs,
    rangeTo: Dayjs,
    dayCount: number
): Promise<void> => {
    const fileName = `rapor-${rangeFrom.format("YYYY-MM-DD")}_${rangeTo.format("YYYY-MM-DD")}.pdf`;

    try {
        // DejaVu Sans: Turkce karakterleri (c, g, i, o, s, u ve buyukleri) tam destekler
        // public/fonts/DejaVuSans.ttf olarak projeye eklenmelidir
        const fontRes = await fetch("/fonts/DejaVuSans.ttf");
        if (!fontRes.ok) throw new Error("Font indirilemedi: " + fontRes.status);
        const fontBuf = await fontRes.arrayBuffer();
        const fontB64 = btoa(
            new Uint8Array(fontBuf).reduce((acc, byte) => acc + String.fromCharCode(byte), "")
        );

        const doc = new jsPDF("p", "mm", "a4") as JsPdfWithTable;
        doc.addFileToVFS("DejaVuSans.ttf", fontB64);
        doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
        doc.setFont("DejaVuSans");

        const pageW = doc.internal.pageSize.getWidth();

        // Header seridi
        doc.setFillColor(41, 128, 185);
        doc.rect(0, 0, pageW, 32, "F");

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(17);
        doc.text("Satış Raporu", 14, 12);
        doc.setFontSize(9.5);
        doc.text(
            `${rangeFrom.format("DD.MM.YYYY")} - ${rangeTo.format("DD.MM.YYYY")}  (${dayCount} gün)`,
            14, 21
        );
        doc.setFontSize(8.5);
        doc.text(`Oluşturulma: ${dayjs().format("DD.MM.YYYY HH:mm")}`, 14, 28.5);

        // Toplam ciro kutusu
        const boxW = 58; const boxH = 26;
        const boxX = pageW - boxW - 10; const boxY = 3;

        doc.setFillColor(39, 174, 96);
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.5);
        doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, "FD");

        doc.setFontSize(8);
        doc.setTextColor(200, 255, 220);
        doc.text("Toplam Ciro", boxX + boxW / 2, boxY + 8, { align: "center" });

        doc.setFontSize(15);
        doc.setTextColor(255, 255, 255);
        doc.text(eur(data.totalRevenue), boxX + boxW / 2, boxY + 19, { align: "center" });

        // Metrik kutulari
        doc.setTextColor(0, 0, 0);
        const metrics = [
            { label: "Toplam Adet",   value: String(data.totalQty) },
            { label: "Sipariş Adedi", value: String(data.orderCount) },
            { label: "En Çok Satan",  value: data.topProduct?.title ?? "-" },
            {
                label: "Ort. Sipariş",
                value: data.orderCount > 0 ? eur(data.totalRevenue / data.orderCount) : "-",
            },
        ];

        const mBoxW = 43; const mBoxH = 18; const mBoxGap = 4;
        const mBoxStartX = 14; const mBoxStartY = 38;

        metrics.forEach((m, i) => {
            const x = mBoxStartX + i * (mBoxW + mBoxGap);
            doc.setFillColor(245, 248, 252);
            doc.setDrawColor(200, 210, 220);
            doc.setLineWidth(0.3);
            doc.roundedRect(x, mBoxStartY, mBoxW, mBoxH, 2, 2, "FD");
            doc.setFontSize(7.5);
            doc.setTextColor(100, 100, 100);
            doc.text(m.label, x + 3, mBoxStartY + 5.5);
            doc.setFontSize(9);
            doc.setTextColor(30, 30, 30);
            const val = m.value.length > 16 ? m.value.slice(0, 15) + "..." : m.value;
            doc.text(val, x + 3, mBoxStartY + 13);
        });

        // Urun tablosu
        const tableStartY = mBoxStartY + mBoxH + 8;
        doc.setFontSize(11);
        doc.setTextColor(41, 128, 185);
        doc.text("Ürün Detayları", 14, tableStartY);

        autoTable(doc, {
            startY: tableStartY + 4,
            head: [["Ürün", "Miktar", "Ciro", "Ort. Fiyat", "Pay %"]],
            body: data.byProduct.map((row) => {
                const avg   = row.qty > 0 ? row.revenue / row.qty : 0;
                const share = data.totalRevenue > 0 ? (row.revenue / data.totalRevenue) * 100 : 0;
                return [row.title, String(row.qty), eur(row.revenue), eur(avg), `${share.toFixed(1)}%`];
            }),
            styles:          { fontSize: 9, font: "DejaVuSans", cellPadding: 3 },
            headStyles:      { font: "DejaVuSans", fontStyle: "normal", fillColor: [41, 128, 185], textColor: 255 },
            alternateRowStyles: { fillColor: [245, 248, 252] },
            columnStyles: {
                0: { cellWidth: 70 },
                1: { halign: "right", cellWidth: 20 },
                2: { halign: "right", cellWidth: 35 },
                3: { halign: "right", cellWidth: 35 },
                4: { halign: "right", cellWidth: 25 },
            },
        });

        // Gunluk seri tablosu
        if (data.series.length > 0) {
            const afterTable  = (doc as JsPdfWithTable).lastAutoTable?.finalY ?? tableStartY + 10;
            const seriesStart = afterTable + 10;
            const pageH       = doc.internal.pageSize.getHeight();
            const footerH     = 18; // footer icin birakilacak alan
            // Baslik (8mm) + tablo header (10mm) + en az 2 satir (14mm) = ~32mm
            const minNeeded   = 32;
            const startY      = seriesStart + minNeeded > pageH - footerH
                ? (() => { doc.addPage(); return 16; })()
                : seriesStart;

            doc.setFontSize(11);
            doc.setTextColor(41, 128, 185);
            doc.text("Günlük Dağılım", 14, startY);

            autoTable(doc, {
                startY: startY + 4,
                head: [["Tarih", "Ciro", "Adet"]],
                body: data.series.map((pt) => [pt.label, eur(pt.revenue), String(pt.qty)]),
                styles:          { fontSize: 9, font: "DejaVuSans", cellPadding: 3 },
                headStyles:      { font: "DejaVuSans", fontStyle: "normal", fillColor: [41, 128, 185], textColor: 255 },
                alternateRowStyles: { fillColor: [245, 248, 252] },
                columnStyles: {
                    0: { cellWidth: 40 },
                    1: { halign: "right", cellWidth: 50 },
                    2: { halign: "right", cellWidth: 30 },
                },
            });
        }

        // Footer
        const pageCount = doc.getNumberOfPages();
        const pageH     = doc.internal.pageSize.getHeight();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setDrawColor(200, 210, 220);
            doc.line(14, pageH - 12, pageW - 14, pageH - 12);
            doc.setFontSize(7.5);
            doc.setFont("DejaVuSans");
            doc.setTextColor(150, 150, 150);
            doc.text(`Sayfa ${i} / ${pageCount}`, pageW / 2, pageH - 6, { align: "center" });
        }

        doc.setTextColor(0);
        doc.save(fileName);

    } catch (err) {
        console.error("PDF hatasi:", err);

        // Fallback: font olmadan basit PDF
        try {
            const doc = new jsPDF("p", "mm", "a4") as JsPdfWithTable;
            doc.setFontSize(16);
            doc.text("Satış Raporu", 14, 18);
            doc.setFontSize(10);
            doc.text(`${rangeFrom.format("DD.MM.YYYY")} - ${rangeTo.format("DD.MM.YYYY")}`, 14, 28);
            doc.text(`Toplam: ${eur(data.totalRevenue)}`, 14, 36);
            autoTable(doc, {
                startY: 44,
                head:   [["Ürün", "Miktar", "Ciro"]],
                body:   data.byProduct.map((r) => [normalizeTurkish(r.title), String(r.qty), eur(r.revenue)]),
            });
            doc.save(`rapor-fallback-${dayjs().format("YYYY-MM-DD")}.pdf`);
        } catch { /* ignore */ }
    }
}