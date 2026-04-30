import * as React from "react";
import dayjs, { Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import {
    Box, Button, Card, CardContent, Chip, Divider, Skeleton, Stack,
    Typography, useMediaQuery, useTheme, Table, TableBody, TableCell,
    TableHead, TableRow, Paper, Alert,
} from "@mui/material";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis,
    Tooltip, CartesianGrid, BarChart, Bar,
} from "recharts";
import { ref as rtdbRef, get } from "firebase/database";
import { db } from "../../firebase/firebase";
import { handleDownloadPdf as generateReportPdf, type ReportResponse, type ProductRow, type TimePoint } from "./utils/handleDownloadPdf";

dayjs.extend(isoWeek);

type ReportNode = {
    totals?:   { revenue?: number; qty?: number; orderCount?: number };
    products?: Record<string, { title?: string; qty?: number; revenue?: number }>;
    series?:   Record<string, { qty?: number; revenue?: number }>;
};

function eur(n: number) {
    return (
        new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " TL"
    );
}

function pad2(n: number) { return String(n).padStart(2, "0"); }

function dayKey(d: Date) {
    const tr = new Date(d.getTime() + 3 * 60 * 60 * 1000);
    return `${tr.getUTCFullYear()}-${pad2(tr.getUTCMonth() + 1)}-${pad2(tr.getUTCDate())}`;
}

function toNumber(x: unknown): number {
    if (typeof x === "number") return x;
    if (typeof x === "string") { const n = Number(x); return Number.isNaN(n) ? 0 : n; }
    return 0;
}

function getDaysBetween(from: Dayjs, to: Dayjs): Dayjs[] {
    const days: Dayjs[] = [];
    let cur = from.startOf("day");
    const end = to.startOf("day");
    while (cur.isBefore(end) || cur.isSame(end, "day")) { days.push(cur); cur = cur.add(1, "day"); }
    return days;
}

// Data fetching
async function fetchDailyNode(dKey: string): Promise<ReportNode | null> {
    const snap = await get(rtdbRef(db, `reportsDaily/${dKey}`));
    return snap.exists() ? (snap.val() as ReportNode) : null;
}

async function fetchRangeReport(from: Dayjs, to: Dayjs): Promise<ReportResponse> {
    const days  = getDaysBetween(from, to);
    const nodes = await Promise.all(days.map((d) => fetchDailyNode(dayKey(d.toDate()))));

    const productMap = new Map<string, { title: string; qty: number; revenue: number }>();
    const seriesEntries: TimePoint[] = [];

    let totalRevenue = 0, totalQty = 0, orderCount = 0;

    nodes.forEach((node, idx) => {
        if (!node) { seriesEntries.push({ label: days[idx]!.format("DD.MM"), revenue: 0, qty: 0 }); return; }
        const t = node.totals ?? {};
        totalRevenue += toNumber(t.revenue);
        totalQty     += toNumber(t.qty);
        orderCount   += toNumber(t.orderCount);

        Object.entries(node.products ?? {}).forEach(([pid, p]) => {
            const existing = productMap.get(pid);
            if (existing) {
                existing.qty     += Math.trunc(toNumber(p?.qty));
                existing.revenue += toNumber(p?.revenue);
            } else {
                productMap.set(pid, { title: String(p?.title ?? pid), qty: Math.trunc(toNumber(p?.qty)), revenue: toNumber(p?.revenue) });
            }
        });

        seriesEntries.push({
            label:   days[idx]!.format("DD.MM"),
            revenue: toNumber(node.totals?.revenue),
            qty:     Math.trunc(toNumber(node.totals?.qty)),
        });
    });

    const byProduct: ProductRow[] = Array.from(productMap.entries())
        .map(([productId, p]) => ({ productId, ...p }))
        .sort((a, b) => b.revenue - a.revenue);

    const top = byProduct[0];

    return {
        fromISO:    from.toISOString(),
        toISO:      to.toISOString(),
        totalRevenue,
        totalQty:   Math.trunc(totalQty),
        orderCount: Math.trunc(orderCount),
        topProduct: top ? { title: top.title, qty: top.qty, revenue: top.revenue } : undefined,
        byProduct,
        series:     seriesEntries,
    };
}

// MetricCard
function MetricCard(props: { title: string; value: React.ReactNode; hint?: React.ReactNode }) {
    return (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
                <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">{props.title}</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>{props.value}</Typography>
                    {props.hint && <Typography variant="caption" color="text.secondary">{props.hint}</Typography>}
                </Stack>
            </CardContent>
        </Card>
    );
}

// ReportsPage
export const ReportsPage = () => {
    const theme  = useTheme();
    const isMdUp = useMediaQuery(theme.breakpoints.up("md"));

    const [rangeFrom, setRangeFrom] = React.useState<Dayjs>(dayjs().subtract(6, "day").startOf("day"));
    const [rangeTo,   setRangeTo]   = React.useState<Dayjs>(dayjs().endOf("day"));
    const [rangeError, setRangeError] = React.useState<string | null>(null);
    const [pdfLoading, setPdfLoading] = React.useState(false);

    const [{ loading, data, error }, setState] = React.useState<{
        loading: boolean;
        data: ReportResponse | null;
        error: string | null;
    }>({ loading: true, data: null, error: null });

    // Derived
    const dayCount = React.useMemo(
        () => rangeTo.diff(rangeFrom, "day") + 1,
        [rangeFrom, rangeTo]
    );

    const top5 = React.useMemo(
        () => (data?.byProduct ?? []).slice(0, 5),
        [data]
    );

    const top5ChartData = React.useMemo(
        () => top5.map((x) => ({ name: x.title, revenue: x.revenue })),
        [top5]
    );

    const xAxisInterval = React.useMemo(
        () => isMdUp ? ("preserveStartEnd" as const) : Math.floor((data?.series.length ?? 1) / 5),
        [isMdUp, data?.series.length]
    );

    // Tarih validasyonu
    React.useEffect(() => {
        if (rangeTo.isBefore(rangeFrom, "day")) {
            setRangeError("Bitis tarihi baslangic tarihinden once olamaz.");
        } else if (rangeTo.diff(rangeFrom, "day") > 365) {
            setRangeError("Tarih araligi en fazla 365 gun olabilir.");
        } else {
            setRangeError(null);
        }
    }, [rangeFrom, rangeTo]);

    // Veri cekme
    React.useEffect(() => {
        if (rangeError) return;
        let alive = true;
        setState((s) => ({ ...s, loading: true, error: null }));

        fetchRangeReport(rangeFrom, rangeTo)
            .then((res) => { if (alive) setState({ loading: false, data: res, error: null }); })
            .catch((e: unknown) => {
                if (alive) setState({
                    loading: false, data: null,
                    error: e instanceof Error ? e.message : "Bilinmeyen hata",
                });
            });

        return () => { alive = false; };
    }, [rangeFrom.toISOString(), rangeTo.toISOString(), rangeError]);

    // Date preset handlers
    const handleLast7 = React.useCallback(() => {
        setRangeFrom(dayjs().subtract(6, "day").startOf("day"));
        setRangeTo(dayjs().endOf("day"));
    }, []);

    const handleLast30 = React.useCallback(() => {
        setRangeFrom(dayjs().subtract(29, "day").startOf("day"));
        setRangeTo(dayjs().endOf("day"));
    }, []);

    const handleThisMonth = React.useCallback(() => {
        setRangeFrom(dayjs().startOf("month"));
        setRangeTo(dayjs().endOf("day"));
    }, []);

    const handleLastMonth = React.useCallback(() => {
        setRangeFrom(dayjs().subtract(1, "month").startOf("month"));
        setRangeTo(dayjs().subtract(1, "month").endOf("month"));
    }, []);

    const handleFromChange = React.useCallback(
        (v: Dayjs | null) => { if (v) setRangeFrom(v.startOf("day")); },
        []
    );

    const handleToChange = React.useCallback(
        (v: Dayjs | null) => { if (v) setRangeTo(v.endOf("day")); },
        []
    );

    // PDF indir
    const handleDownloadPdf = React.useCallback(async () => {
        if (!data) return;
        setPdfLoading(true);
        try {
            await generateReportPdf(data, rangeFrom, rangeTo, dayCount);
        } finally {
            setPdfLoading(false);
        }
    }, [data, rangeFrom, rangeTo, dayCount]);

    // ─── Active variant helpers
    const last7Variant   = rangeFrom.isSame(dayjs().subtract(6, "day"), "day") && rangeTo.isSame(dayjs(), "day") ? "contained" : "outlined";
    const last30Variant  = rangeFrom.isSame(dayjs().subtract(29, "day"), "day") && rangeTo.isSame(dayjs(), "day") ? "contained" : "outlined";
    const thisMonVariant = rangeFrom.isSame(dayjs().startOf("month"), "day") && rangeTo.isSame(dayjs(), "day") ? "contained" : "outlined";

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1300, mx: "auto" }}>
                <Stack spacing={2.5}>

                    {/* Header */}
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }} justifyContent="space-between">
                        <Stack spacing={0.3}>
                            <Typography variant="h5" sx={{ fontWeight: 900 }}>Raporlar</Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Chip label={`${dayCount} gun`} size="small" color="primary" variant="outlined" />
                                <Typography variant="body2" color="text.secondary">
                                    {rangeFrom.format("DD.MM.YYYY")} - {rangeTo.format("DD.MM.YYYY")}
                                </Typography>
                            </Stack>
                        </Stack>

                        <Button
                            variant="contained"
                            startIcon={<FileDownloadOutlinedIcon />}
                            onClick={handleDownloadPdf}
                            disabled={loading || !data || pdfLoading || !!rangeError}
                            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 2, alignSelf: { xs: "stretch", md: "auto" } }}
                        >
                            {pdfLoading ? "Hazirlaniyor..." : "PDF Indir"}
                        </Button>
                    </Stack>

                    {/* Tarih Filtresi */}
                    <Card variant="outlined" sx={{ borderRadius: 3 }}>
                        <CardContent>
                            <Stack spacing={1.5}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "text.secondary" }}>
                                    Tarih Araligi
                                </Typography>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} flexWrap="wrap">
                                    <DatePicker
                                        label="Baslangic Tarihi"
                                        value={rangeFrom}
                                        onChange={handleFromChange}
                                        maxDate={dayjs()}
                                        format="DD.MM.YYYY"
                                        slotProps={{ textField: { size: "small", sx: { minWidth: 170 } } }}
                                    />
                                    <Typography variant="body1" color="text.secondary" sx={{ display: { xs: "none", sm: "block" }, fontWeight: 700 }}>
                                        →
                                    </Typography>
                                    <DatePicker
                                        label="Bitis Tarihi"
                                        value={rangeTo}
                                        onChange={handleToChange}
                                        minDate={rangeFrom}
                                        maxDate={dayjs()}
                                        format="DD.MM.YYYY"
                                        slotProps={{ textField: { size: "small", sx: { minWidth: 170 } } }}
                                    />
                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                        <Button size="small" variant={last7Variant}   sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }} onClick={handleLast7}>Son 7 Gun</Button>
                                        <Button size="small" variant={last30Variant}  sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }} onClick={handleLast30}>Son 30 Gun</Button>
                                        <Button size="small" variant={thisMonVariant} sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }} onClick={handleThisMonth}>Bu Ay</Button>
                                        <Button size="small" variant="outlined"       sx={{ borderRadius: 2, textTransform: "none", fontWeight: 700 }} onClick={handleLastMonth}>Gecen Ay</Button>
                                    </Stack>
                                </Stack>
                                {rangeError && <Alert severity="error" sx={{ py: 0.5 }}>{rangeError}</Alert>}
                            </Stack>
                        </CardContent>
                    </Card>

                    {/* Metrics */}
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ "& > *": { flex: 1 } }}>
                        <MetricCard title="Toplam Ciro"    value={loading ? <Skeleton width={120} /> : eur(data?.totalRevenue ?? 0)} />
                        <MetricCard title="Toplam Adet"    value={loading ? <Skeleton width={80} />  : data?.totalQty ?? 0} />
                        <MetricCard title="Siparis Sayisi" value={loading ? <Skeleton width={60} />  : data?.orderCount ?? 0} />
                        <MetricCard
                            title="En Cok Satan"
                            value={loading ? <Skeleton width={160} /> : data?.topProduct?.title ?? "-"}
                            hint={
                                loading ? null
                                    : data?.topProduct
                                        ? `${data.topProduct.qty} adet - ${eur(data.topProduct.revenue)}`
                                        : null
                            }
                        />
                    </Stack>

                    {/* Charts */}
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                        <Card variant="outlined" sx={{ borderRadius: 3, flex: 1 }}>
                            <CardContent>
                                <Stack spacing={1}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Gunluk Ciro Trendi</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {rangeFrom.format("DD.MM.YYYY")} - {rangeTo.format("DD.MM.YYYY")}
                                    </Typography>
                                    <Divider />
                                    <Box sx={{ height: 280, mt: 1 }}>
                                        {loading ? <Skeleton variant="rounded" height={280} /> : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={data?.series ?? []}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={xAxisInterval} />
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
                                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Top Urunler (Ilk 5)</Typography>
                                    <Typography variant="caption" color="text.secondary">Urun bazinda ciro karsilastirmasi</Typography>
                                    <Divider />
                                    <Box sx={{ height: 280, mt: 1 }}>
                                        {loading ? <Skeleton variant="rounded" height={280} /> : (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={top5ChartData}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="name" hide />
                                                    <YAxis />
                                                    <Tooltip formatter={(v) => eur(Number(v))} labelFormatter={(label) => label} />
                                                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Stack>

                    {/* Product Table */}
                    <Card variant="outlined" sx={{ borderRadius: 3 }}>
                        <CardContent>
                            <Stack spacing={1}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Urun Detaylari</Typography>
                                    {error && <Typography variant="caption" color="error">{error}</Typography>}
                                </Stack>
                                <Divider />
                                <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 900 }}>Urun</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900 }}>Miktar</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900 }}>Ciro</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900 }}>Ort. Fiyat</TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 900 }}>Pay</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {loading ? (
                                                Array.from({ length: 6 }).map((_, i) => (
                                                    <TableRow key={`sk-${i}`}>
                                                        <TableCell><Skeleton width={220} /></TableCell>
                                                        <TableCell align="right"><Skeleton width={40} /></TableCell>
                                                        <TableCell align="right"><Skeleton width={80} /></TableCell>
                                                        <TableCell align="right"><Skeleton width={80} /></TableCell>
                                                        <TableCell align="right"><Skeleton width={60} /></TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (data?.byProduct ?? []).length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>
                                                        Bu tarih araliginda veri bulunamadi.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                (data?.byProduct ?? []).map((row) => {
                                                    const avg      = row.qty > 0 ? row.revenue / row.qty : 0;
                                                    const totalRev = data?.totalRevenue ?? 0;
                                                    const share    = totalRev > 0 ? (row.revenue / totalRev) * 100 : 0;
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