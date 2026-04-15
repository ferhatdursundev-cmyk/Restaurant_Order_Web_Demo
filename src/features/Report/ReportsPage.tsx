import * as React from "react";
import dayjs, { Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Skeleton,
    Stack,
    Tab,
    Tabs,
    Typography,
    useMediaQuery,
    useTheme,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Paper,
} from "@mui/material";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    BarChart,
    Bar,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { ref as rtdbRef, get } from "firebase/database";
import { db } from "../../firebase/firebase";

dayjs.extend(isoWeek);

type Granularity = "daily" | "weekly" | "monthly";

type TableRec = {
    id: string;
    name?: string;
    number?: number;
};

type ProductRow = {
    productId: string;
    title: string;
    qty: number;
    revenue: number;
};

type TimePoint = {
    label: string;
    revenue: number;
    qty: number;
};

type ReportResponse = {
    fromISO: string;
    toISO: string;
    totalRevenue: number;
    totalQty: number;
    orderCount: number;
    topProduct?: { title: string; qty: number; revenue: number };
    byProduct: ProductRow[];
    series: TimePoint[];
};

type StatusFilter = "all" | "new" | "paid" | "completed";
type SourceFilter = "all" | "basket";

type ReportNode = {
    totals?: { revenue?: number; qty?: number; orderCount?: number };
    products?: Record<string, { title?: string; qty?: number; revenue?: number }>;
    series?: Record<string, { qty?: number; revenue?: number }>;
};

type JsPdfWithTable = jsPDF & {
    lastAutoTable?: {
        finalY: number;
    };
};

function eur(n: number) {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

function toRange(granularity: Granularity, anchor: Dayjs) {
    if (granularity === "daily") return { from: anchor.startOf("day"), to: anchor.endOf("day") };
    if (granularity === "weekly") return { from: anchor.startOf("isoWeek"), to: anchor.endOf("isoWeek") };
    return { from: anchor.startOf("month"), to: anchor.endOf("month") };
}

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function dayKey(d: Date) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthKey(d: Date) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function isoWeekKey(d: Date) {
    // YYYY-WWW
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function toNumber(x: unknown): number {
    if (typeof x === "number") return x;
    if (typeof x === "string") {
        const n = Number(x);
        return Number.isNaN(n) ? 0 : n;
    }
    return 0;
}

function sortSeries(granularity: Granularity, series: TimePoint[]): TimePoint[] {
    const copy = [...series];

    if (granularity === "daily") {
        copy.sort((a, b) => Number(a.label.slice(0, 2)) - Number(b.label.slice(0, 2)));
        return copy;
    }

    if (granularity === "monthly") {
        copy.sort((a, b) => Number(a.label) - Number(b.label));
        return copy;
    }

    const order: Record<string, number> = {
        Pzt: 1,
        Sal: 2,
        Çar: 3,
        Per: 4,
        Cum: 5,
        Cmt: 6,
        Paz: 7,
    };

    copy.sort((a, b) => (order[a.label] ?? 999) - (order[b.label] ?? 999));
    return copy;
}

async function fetchTables(): Promise<TableRec[]> {
    const snap = await get(rtdbRef(db, "tables"));
    const raw = (snap.val() ?? {}) as Record<string, any>;
    return Object.keys(raw)
        .map((id) => {
            const t = raw[id] ?? {};
            return { id, name: t.name, number: t.number } satisfies TableRec;
        })
        .sort((a, b) => (a.number ?? 999) - (b.number ?? 999));
}

/**
 *  Yeni: reportsDaily/Weekly/Monthly node’larından okur.
 * Bu node’lar Cloud Function ile oluşuyor.
 */
async function fetchReport(args: {
    granularity: Granularity;
    fromISO: string;
    toISO: string;
    tableId?: string; // UI’da var ama rapor node’u table kırılımı tutmadığı için kullanılmıyor
    status: StatusFilter; // UI’da var ama rapor node’u status kırılımı tutmadığı için kullanılmıyor
    source: SourceFilter; // UI’da var ama rapor node’u source kırılımı tutmadığı için kullanılmıyor
}): Promise<ReportResponse> {
    const from = new Date(args.fromISO);

    let path = "";
    if (args.granularity === "daily") path = `reportsDaily/${dayKey(from)}`;
    else if (args.granularity === "weekly") path = `reportsWeekly/${isoWeekKey(from)}`;
    else path = `reportsMonthly/${monthKey(from)}`;

    const snap = await get(rtdbRef(db, path));
    const node = snap.exists() ? (snap.val() as ReportNode) : null;

    const totals = node?.totals ?? {};
    const totalRevenue = toNumber(totals.revenue);
    const totalQty = Math.trunc(toNumber(totals.qty));
    const orderCount = Math.trunc(toNumber(totals.orderCount));

    const byProduct: ProductRow[] = Object.entries(node?.products ?? {})
        .map(([productId, p]) => ({
            productId,
            title: String(p?.title ?? productId),
            qty: Math.trunc(toNumber(p?.qty)),
            revenue: toNumber(p?.revenue),
        }))
        .sort((a, b) => b.revenue - a.revenue);

    const seriesRaw = node?.series ?? {};
    const series: TimePoint[] = Object.entries(seriesRaw).map(([k, v]) => {
        let label = k;

        if (args.granularity === "daily") {
            // series key "20" -> "20:00"
            label = `${pad2(Number(k))}:00`;
        } else if (args.granularity === "weekly") {
            const map: Record<string, string> = {
                "1": "Pzt",
                "2": "Sal",
                "3": "Çar",
                "4": "Per",
                "5": "Cum",
                "6": "Cmt",
                "7": "Paz",
            };
            label = map[k] ?? k;
        }

        return {
            label,
            qty: Math.trunc(toNumber(v?.qty)),
            revenue: toNumber(v?.revenue),
        };
    });

    const seriesSorted = sortSeries(args.granularity, series);
    const top = byProduct[0];

    return {
        fromISO: args.fromISO,
        toISO: args.toISO,
        totalRevenue,
        totalQty,
        orderCount,
        topProduct: top ? { title: top.title, qty: top.qty, revenue: top.revenue } : undefined,
        byProduct,
        series: seriesSorted,
    };
}

function MetricCard(props: { title: string; value: React.ReactNode; hint?: React.ReactNode }) {
    return (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
                <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                        {props.title}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        {props.value}
                    </Typography>
                    {props.hint ? (
                        <Typography variant="caption" color="text.secondary">
                            {props.hint}
                        </Typography>
                    ) : null}
                </Stack>
            </CardContent>
        </Card>
    );
}

export const ReportsPage = () => {
    const theme = useTheme();
    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

    const [granularity, setGranularity] = React.useState<Granularity>("daily");
    const [anchorDate, setAnchorDate] = React.useState<Dayjs>(dayjs());

    // filters (UI’da kalsın)
    const [tables, setTables] = React.useState<TableRec[]>([]);
    const [tableId, setTableId] = React.useState<string>("all");
    const [status, setStatus] = React.useState<StatusFilter>("all");
    const [source, setSource] = React.useState<SourceFilter>("all");

    const [{ loading, data, error }, setState] = React.useState<{
        loading: boolean;
        data: ReportResponse | null;
        error: string | null;
    }>({ loading: true, data: null, error: null });

    const range = React.useMemo(() => toRange(granularity, anchorDate), [granularity, anchorDate]);

    React.useEffect(() => {
        let alive = true;
        fetchTables()
            .then((t) => {
                if (!alive) return;
                setTables(t);
            })
            .catch(() => {
                // tablo listesi şart değil
            });
        return () => {
            alive = false;
        };
    }, []);

    React.useEffect(() => {
        let alive = true;
        setState((s) => ({ ...s, loading: true, error: null }));

        fetchReport({
            granularity,
            fromISO: range.from.toISOString(),
            toISO: range.to.toISOString(),
            tableId: tableId === "all" ? undefined : tableId,
            status,
            source,
        })
            .then((res) => {
                if (!alive) return;
                setState({ loading: false, data: res, error: null });
            })
            .catch((e: unknown) => {
                if (!alive) return;
                setState({
                    loading: false,
                    data: null,
                    error: e instanceof Error ? e.message : "Unknown error",
                });
            });

        return () => {
            alive = false;
        };
    }, [granularity, range.from, range.to, tableId, status, source]);

    const titleRange = React.useMemo(() => {
        if (granularity === "daily") return anchorDate.format("DD.MM.YYYY");
        if (granularity === "weekly") return `${range.from.format("DD.MM")} – ${range.to.format("DD.MM.YYYY")}`;
        return anchorDate.format("MMMM YYYY");
    }, [granularity, anchorDate, range.from, range.to]);

    const top5 = React.useMemo(() => (data?.byProduct ?? []).slice(0, 5), [data]);

    // Rapor node’larında table/status/source kırılımı olmadığı için UI filtreleri pasif
    const filtersDisabledHint =
        "Bu rapor yapısı şu an masa/durum/kaynak kırılımı tutmuyor. İstersen bunu da rapor node’larına ekleyebiliriz.";

    const handleDownloadPdf = React.useCallback(() => {
        if (!data) return;

        const doc = new jsPDF("p", "mm", "a4") as JsPdfWithTable;

        const reportTitle =
            granularity === "daily"
                ? "Günlük Rapor"
                : granularity === "weekly"
                    ? "Haftalık Rapor"
                    : "Aylık Rapor";

        const fileName =
            granularity === "daily"
                ? `rapor-gunluk-${anchorDate.format("YYYY-MM-DD")}.pdf`
                : granularity === "weekly"
                    ? `rapor-haftalik-${range.from.format("YYYY-MM-DD")}_${range.to.format("YYYY-MM-DD")}.pdf`
                    : `rapor-aylik-${anchorDate.format("YYYY-MM")}.pdf`;

        doc.setFontSize(18);
        doc.text(reportTitle, 14, 18);

        doc.setFontSize(11);
        doc.text(`Tarih Aralıgı: ${range.from.format("DD.MM.YYYY")} - ${range.to.format("DD.MM.YYYY")}`, 14, 26);

        doc.setFontSize(10);
        doc.text(`Toplam Ciro: ${eur(data.totalRevenue)}`, 14, 36);
        doc.text(`Toplam Adet: ${String(data.totalQty)}`, 14, 42);
        doc.text(`Siparis Adet: ${String(data.orderCount)}`, 14, 48);
        doc.text(`En Çok Satan: ${data.topProduct?.title ?? "-"}`, 14, 54);

        autoTable(doc, {
            startY: 62,
            head: [["Ürün", "Miktar", "Ciro", "Ort. Fiyat", "Pay"]],
            body: data.byProduct.map((row) => {
                const avg = row.qty > 0 ? row.revenue / row.qty : 0;
                const share = data.totalRevenue > 0 ? (row.revenue / data.totalRevenue) * 100 : 0;

                return [
                    row.title,
                    String(row.qty),
                    eur(row.revenue),
                    eur(avg),
                    `${share.toFixed(1)}%`,
                ];
            }),
            styles: {
                fontSize: 9,
            },
            headStyles: {
                fontStyle: "bold",
            },
        });
        doc.setFontSize(12);
        doc.save(fileName);
    }, [data, granularity, anchorDate, range.from, range.to]);

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1300, mx: "auto" }}>
                <Stack spacing={2.5}>
                    {/* Header */}
                    <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1.5}
                        alignItems={{ md: "center" }}
                        justifyContent="space-between"
                    >
                        <Stack spacing={0.3}>
                            <Typography variant="h5" sx={{ fontWeight: 900 }}>
                                Raporlar
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Chip
                                    label={granularity === "daily" ? "Günlük" : granularity === "weekly" ? "Haftalık" : "Aylık"}
                                    size="small"
                                />
                                <Typography variant="body2" color="text.secondary">
                                    {titleRange}
                                </Typography>
                            </Stack>
                        </Stack>

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                            <Button
                                variant="contained"
                                startIcon={<FileDownloadOutlinedIcon />}
                                onClick={handleDownloadPdf}
                                disabled={loading || !data}
                                sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2 }}
                            >
                                PDF İndir
                            </Button>

                            <Tabs
                                value={granularity}
                                onChange={(_, v) => setGranularity(v)}
                                textColor="inherit"
                                indicatorColor="primary"
                                variant={isMdUp ? "standard" : "scrollable"}
                                scrollButtons={false}
                                sx={{ "& .MuiTab-root": { textTransform: "none", fontWeight: 800, minHeight: 40 } }}
                            >
                                <Tab value="daily" label="Günlük" />
                                <Tab value="weekly" label="Haftalık" />
                                <Tab value="monthly" label="Aylık" />
                            </Tabs>
                        </Stack>
                    </Stack>

                    {/* Filters */}
                    <Card variant="outlined" sx={{ borderRadius: 3 }}>
                        <CardContent>
                            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
                                <DatePicker
                                    label={granularity === "daily" ? "Tarih" : granularity === "weekly" ? "Hafta (tarih seç)" : "Ay (tarih seç)"}
                                    value={anchorDate}
                                    onChange={(v) => v && setAnchorDate(v)}
                                    slotProps={{ textField: { size: "small", fullWidth: true } }}
                                />

                                <FormControl size="small" fullWidth disabled title={filtersDisabledHint}>
                                    <InputLabel id="table">Masa</InputLabel>
                                    <Select labelId="table" label="Masa" value={tableId} onChange={(e) => setTableId(String(e.target.value))}>
                                        <MenuItem value="all">Hepsi</MenuItem>
                                        {tables.map((t) => (
                                            <MenuItem key={t.id} value={t.id}>
                                                {t.name ?? t.id}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <FormControl size="small" fullWidth disabled title={filtersDisabledHint}>
                                    <InputLabel id="status">Durum</InputLabel>
                                    <Select
                                        labelId="status"
                                        label="Durum"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as StatusFilter)}
                                    >
                                        <MenuItem value="all">Hepsi</MenuItem>
                                        <MenuItem value="new">new</MenuItem>
                                        <MenuItem value="paid">paid</MenuItem>
                                        <MenuItem value="completed">completed</MenuItem>
                                    </Select>
                                </FormControl>

                                <FormControl size="small" fullWidth disabled title={filtersDisabledHint}>
                                    <InputLabel id="source">Kaynak</InputLabel>
                                    <Select
                                        labelId="source"
                                        label="Kaynak"
                                        value={source}
                                        onChange={(e) => setSource(e.target.value as SourceFilter)}
                                    >
                                        <MenuItem value="all">Hepsi</MenuItem>
                                        <MenuItem value="basket">basket</MenuItem>
                                    </Select>
                                </FormControl>

                                <Box sx={{ flex: 1 }} />
                                <Typography variant="caption" color="text.secondary">
                                    Aralık: {range.from.format("DD.MM.YYYY")} – {range.to.format("DD.MM.YYYY")}
                                </Typography>
                            </Stack>
                        </CardContent>
                    </Card>

                    {/* Metrics */}
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ "& > *": { flex: 1 } }}>
                        <MetricCard title="Toplam Ciro" value={loading ? <Skeleton width={120} /> : eur(data?.totalRevenue ?? 0)} />
                        <MetricCard title="Toplam Adet" value={loading ? <Skeleton width={80} /> : data?.totalQty ?? 0} />
                        <MetricCard title="Sipariş Sayısı" value={loading ? <Skeleton width={60} /> : data?.orderCount ?? 0} />
                        <MetricCard
                            title="En Çok Satan"
                            value={loading ? <Skeleton width={160} /> : data?.topProduct?.title ?? "-"}
                            hint={
                                loading
                                    ? null
                                    : data?.topProduct
                                        ? `${data.topProduct.qty} adet • ${eur(data.topProduct.revenue)}`
                                        : null
                            }
                        />
                    </Stack>

                    {/* Charts */}
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                        <Card variant="outlined" sx={{ borderRadius: 3, flex: 1 }}>
                            <CardContent>
                                <Stack spacing={1}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                        Zamana Göre Ciro
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {granularity === "daily" ? "Saatlik trend" : granularity === "weekly" ? "Günlük trend" : "Gün bazlı trend"}
                                    </Typography>
                                    <Divider />
                                    <Box sx={{ height: 280, mt: 1 }}>
                                        {loading ? (
                                            <Skeleton variant="rounded" height={280} />
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={data?.series ?? []}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="label" />
                                                    <YAxis />
                                                    <Tooltip formatter={(v) => eur(Number(v))} />
                                                    <Line type="monotone" dataKey="revenue" strokeWidth={3} dot={false} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        )}
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>

                        <Card variant="outlined" sx={{ borderRadius: 3, flex: 1 }}>
                            <CardContent>
                                <Stack spacing={1}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                        Top Ürünler (İlk 5)
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Ürün bazında ciro karşılaştırması
                                    </Typography>
                                    <Divider />
                                    <Box sx={{ height: 280, mt: 1 }}>
                                        {loading ? (
                                            <Skeleton variant="rounded" height={280} />
                                        ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={top5.map((x) => ({ name: x.title, revenue: x.revenue }))}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="name" hide />
                                                    <YAxis />
                                                    <Tooltip formatter={(v) => eur(Number(v))} />
                                                    <Bar dataKey="revenue" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Stack>

                    {/* Table */}
                    <Card variant="outlined" sx={{ borderRadius: 3 }}>
                        <CardContent>
                            <Stack spacing={1}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                                        Ürün Detayları
                                    </Typography>
                                    {error ? (
                                        <Typography variant="caption" color="error">
                                            {error}
                                        </Typography>
                                    ) : null}
                                </Stack>
                                <Divider />

                                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 900 }}>Ürün</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900 }}>
                                                    Miktar
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900 }}>
                                                    Ciro
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900 }}>
                                                    Ort. Fiyat
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900 }}>
                                                    Pay
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>

                                        <TableBody>
                                            {loading ? (
                                                Array.from({ length: 6 }).map((_, i) => (
                                                    <TableRow key={`sk-${i}`}>
                                                        <TableCell>
                                                            <Skeleton width={220} />
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Skeleton width={40} />
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Skeleton width={80} />
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Skeleton width={80} />
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Skeleton width={60} />
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                (data?.byProduct ?? []).map((row) => {
                                                    const avg = row.qty > 0 ? row.revenue / row.qty : 0;
                                                    const totalRev = data?.totalRevenue ?? 0;
                                                    const share = totalRev > 0 ? (row.revenue / totalRev) * 100 : 0;

                                                    return (
                                                        <TableRow key={row.productId} hover>
                                                            <TableCell>{row.title}</TableCell>
                                                            <TableCell align="right">{row.qty}</TableCell>
                                                            <TableCell align="right">{eur(row.revenue)}</TableCell>
                                                            <TableCell align="right">{eur(avg)}</TableCell>
                                                            <TableCell align="right">{share.toFixed(1)}%</TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </Paper>
                            </Stack>
                        </CardContent>
                    </Card>
                </Stack>
            </Box>
        </LocalizationProvider>
    );
};