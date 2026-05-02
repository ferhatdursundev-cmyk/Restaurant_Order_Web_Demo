import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onValueCreated } from "firebase-functions/v2/database";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { randomBytes } from "crypto";
import nodemailer from "nodemailer";
import {onRequest} from "firebase-functions/https";

admin.initializeApp();

const SMTP_HOST = defineSecret("SMTP_HOST");
const SMTP_PORT = defineSecret("SMTP_PORT");
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
const SMTP_FROM = defineSecret("SMTP_FROM");

const ALLOWED_ORIGINS = [
    "https://restaurant-order-web-demo.vercel.app",
];

// ─── Types ────────────────────────────────────────────────────────────────────
type CreateUserBody = {
    email: string;
    password: string;
    name: string;
    phoneNumber?: string;
    userType: string;
    isAdmin: boolean;
};

type MintReq = { tableId: string; qrKey: string };
type MintRes = { sessionToken: string; exp: number };

type GetOrdersReq = { tableId: string; sessionToken: string };
type GetOrdersRes = { orders: Record<string, unknown> | null };

type OrderItem = {
    cartId?: string;
    productId?: string;
    title?: string;
    unitPrice?: number;
    qty?: number;
    note?: string;
    image?: string;
};

type OrderPayload = {
    author?: string;
    customerEmail?: string;
    status?: string;
    createdAt?: unknown;
    createdAtMs?: number;
    source?: string;
    tableId?: string;
    total?: number;
    publicOrderNo?: number;
    items?: OrderItem[];
};

type ReservationData = {
    status?: string;
    customerName?: string;
    customerEmail?: string;
    date?: string;
    time?: string;
    endTime?: string;
    partySize?: number;
    tableId?: string;
    note?: string;
};

export { paySelection } from "./paySelected";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNonEmptyString(v: unknown): v is string {
    return typeof v === "string" && v.trim().length > 0;
}

function base64UrlToken(bytes = 24): string {
    return randomBytes(bytes)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function formatPriceEUR(value: number) {
    return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
    }).format(value);
}

function createMailTransporter() {
    const port = Number(SMTP_PORT.value());
    return nodemailer.createTransport({
        host: SMTP_HOST.value(),
        port,
        secure: port === 465,
        auth: {
            user: SMTP_USER.value(),
            pass: SMTP_PASS.value(),
        },
    });
}

async function assertIsAdmin(callerUid: string): Promise<void> {
    const snap = await admin.database().ref(`users/${callerUid}`).get();
    const userData = snap.val();
    if (userData?.isAdmin !== true && userData?.userType !== "admin") {
        throw new HttpsError("permission-denied", "Admin değil.");
    }
}

function buildOrderMail(orderId: string, tableId: string, order: OrderPayload) {
    const items       = Array.isArray(order.items) ? order.items : [];
    const total       = Number(order.total || 0);
    const publicOrderNo = typeof order.publicOrderNo === "number" ? order.publicOrderNo : null;

    const subject = publicOrderNo
        ? `Siparişiniz alındı #${publicOrderNo}`
        : "Siparişiniz alındı";

    const textLines: string[] = [];
    textLines.push("Siparişiniz başarıyla oluşturuldu.");
    textLines.push("");
    textLines.push(`Sipariş ID: ${orderId}`);
    if (publicOrderNo) textLines.push(`Takip Numarasi: ${publicOrderNo}`);
    textLines.push("Oluşturan: Paket Servis");
    textLines.push("");
    textLines.push("Ürünler:");

    for (const item of items) {
        const qty       = Number(item.qty || 1);
        const title     = String(item.title || "");
        const note      = String(item.note || "");
        const unitPrice = Number(item.unitPrice || 0);
        textLines.push(`- ${qty}x ${title} (${formatPriceEUR(unitPrice)})`);
        if (note) textLines.push(`  Not: ${note}`);
    }

    textLines.push("");
    textLines.push(`Toplam: ${formatPriceEUR(total)}`);

    const itemsHtml = items.map((item) => {
        const qty       = Number(item.qty || 1);
        const title     = String(item.title || "");
        const note      = String(item.note || "");
        const unitPrice = Number(item.unitPrice || 0);
        return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${qty}x</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">
            ${title}
            ${note ? `<br/><small>Not: ${note}</small>` : ""}
          </td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${formatPriceEUR(unitPrice)}</td>
        </tr>`;
    }).join("");

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111;max-width:700px;margin:0 auto;padding:24px;">
        <h2 style="margin-bottom:8px;">Siparişiniz alındı</h2>
        <p>Siparişiniz başarıyla oluşturuldu.</p>
        <div style="margin:16px 0;padding:16px;border:1px solid #eee;border-radius:12px;">
          <p><strong>Sipariş ID:</strong> ${orderId}</p>
          ${publicOrderNo ? `<p><strong>Takip Numarasi:</strong> ${publicOrderNo}</p>` : ""}
          <p><strong>Oluşturan:</strong> Paket Servis</p>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th align="left" style="padding:8px;border-bottom:2px solid #ddd;">Adet</th>
              <th align="left" style="padding:8px;border-bottom:2px solid #ddd;">Ürün</th>
              <th align="left" style="padding:8px;border-bottom:2px solid #ddd;">Fiyat</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <h3 style="margin-top:20px;">Toplam: ${formatPriceEUR(total)}</h3>
      </div>`;

    return { subject, text: textLines.join("\n"), html };
}

async function sendOrderMailInternal({
                                         tableId,
                                         orderId,
                                         order,
                                     }: {
    tableId: string;
    orderId: string;
    order: OrderPayload | null;
}) {
    if (!order) return;
    if (!order.customerEmail || !order.customerEmail.includes("@")) return;

    const mailLogRef      = admin.database().ref(`mailLogs/${orderId}`);
    const alreadySentSnap = await mailLogRef.child("ok").get();
    if (alreadySentSnap.exists() && alreadySentSnap.val() === true) return;

    const transporter = createMailTransporter();
    const mail        = buildOrderMail(orderId, tableId, order);

    try {
        await transporter.sendMail({
            from: SMTP_FROM.value(),
            to:   order.customerEmail,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
        });
        await mailLogRef.set({ ok: true, to: order.customerEmail, sentAt: Date.now(), type: "ORDER_CREATED" });
    } catch (err: any) {
        console.error("sendOrderMailInternal error:", err);
        await mailLogRef.set({ ok: false, to: order.customerEmail, error: err?.message || "unknown error", sentAt: Date.now(), type: "ORDER_CREATED" });
    }
}

// ─── Reservation: Email Verification ──────────────────────────────────────────

export const onReservationCreated = onValueCreated(
    {
        ref: "/reservations/{reservationId}",
        region: "europe-west1",
        instance: "restaurantorderwebdemo-default-rtdb",
        secrets: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM],
    },
    async (event) => {
        const reservationId = event.params.reservationId as string;
        const reservation   = event.data?.val() as ReservationData | null;

        if (!reservation) return;
        if (reservation.status !== "pending_verification") return;
        if (!reservation.customerEmail?.includes("@")) return;

        console.log("onReservationCreated triggered for:", reservationId);

        const token = base64UrlToken(32);
        const exp   = Date.now() + 24 * 60 * 60 * 1000;

        await admin.database()
            .ref(`reservationVerificationTokens/${token}`)
            .set({ reservationId, exp, used: false });

        await admin.database()
            .ref(`reservations/${reservationId}/verificationToken`)
            .set(token);

        const verifyUrl = `https://restaurant-order-web-demo.vercel.app/rezervasyon/verify?token=${token}`;
        const timeStr   = reservation.endTime
            ? `${reservation.time} – ${reservation.endTime}`
            : reservation.time || "-";

        const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
        <h2 style="color:#FF7A00;">E-posta Adresinizi Doğrulayın</h2>
        <p>Merhaba <strong>${reservation.customerName || "Değerli Müşterimiz"}</strong>,</p>
        <p>Rezervasyon talebinizi tamamlamak için aşağıdaki butona tıklayarak e-posta adresinizi doğrulayın.</p>
        <div style="padding:16px;border:1px solid #eee;border-radius:12px;margin:16px 0;">
          <p><strong>Tarih:</strong> ${reservation.date || "-"}</p>
          <p><strong>Saat:</strong> ${timeStr}</p>
          <p><strong>Masa numarası:</strong> ${reservation.tableId || "-"}</p>
          <p><strong>Kişi Sayısı:</strong> ${reservation.partySize || "-"}</p>
        </div>
        <a href="${verifyUrl}"
           style="display:inline-block;background:#FF7A00;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin:16px 0;">
          Rezervasyonu Onayla
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px;">
          Bu link 24 saat geçerlidir. Eğer bu rezervasyonu siz yapmadıysanız bu maili görmezden gelebilirsiniz.
        </p>
      </div>`;

        const text = [
            "E-posta Adresinizi Doğrulayın",
            "",
            `Merhaba ${reservation.customerName},`,
            "",
            "Rezervasyon talebinizi tamamlamak için aşağıdaki linke tıklayın:",
            "",
            verifyUrl,
            "",
            `Tarih: ${reservation.date}`,
            `Saat: ${timeStr}`,
            `Kişi: ${reservation.partySize}`,
            "",
            "Bu link 24 saat geçerlidir.",
        ].join("\n");

        const mailLogRef  = admin.database().ref(`reservationVerifyMailLogs/${reservationId}`);
        const alreadySent = await mailLogRef.child("ok").get();
        if (alreadySent.val() === true) {
            console.log("Verification mail already sent, skipping.");
            return;
        }

        const transporter = createMailTransporter();
        try {
            await transporter.sendMail({
                from: SMTP_FROM.value(),
                to:   reservation.customerEmail,
                subject: "Rezervasyonunuzu Doğrulayın",
                html,
                text,
            });
            console.log("Verification mail sent to:", reservation.customerEmail);
            await mailLogRef.set({ ok: true, to: reservation.customerEmail, sentAt: Date.now() });
        } catch (err: any) {
            console.error("Verification mail error:", err?.message);
            await mailLogRef.set({ ok: false, error: err?.message, sentAt: Date.now() });
        }
    }
);

export const verifyReservationEmail = onRequest(
    { region: "europe-west1" },
    async (req, res) => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        const token = String(req.query.token ?? "").trim();
        if (!token) {
            res.status(400).json({ ok: false, error: "Token eksik." });
            return;
        }

        console.log("verifyReservationEmail called with token:", token);

        try {
            const tokenRef  = admin.database().ref(`reservationVerificationTokens/${token}`);
            const tokenSnap = await tokenRef.get();
            const tokenData = tokenSnap.val() as {
                reservationId: string;
                exp: number;
                used: boolean;
            } | null;

            if (!tokenData) {
                res.status(400).json({ ok: false, error: "Geçersiz token." });
                return;
            }
            if (tokenData.used) {
                res.status(400).json({ ok: false, error: "Bu link daha önce kullanılmış." });
                return;
            }
            if (tokenData.exp < Date.now()) {
                res.status(400).json({ ok: false, error: "Linkin süresi dolmuş." });
                return;
            }

            const { reservationId } = tokenData;

            await admin.database()
                .ref(`reservations/${reservationId}/status`)
                .set("pending");

            await tokenRef.update({ used: true, usedAt: Date.now() });

            console.log("Reservation verified:", reservationId);
            res.status(200).json({ ok: true, reservationId });
        } catch (err: any) {
            console.error("verifyReservationEmail error:", err?.message);
            res.status(500).json({ ok: false, error: "Sunucu hatası." });
        }
    }
);

// ─── Reservation: Status Update ───────────────────────────────────────────────

export const updateReservationStatus = onCall(
    {
        region: "europe-west1",
        cors: ALLOWED_ORIGINS,
        secrets: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM],
    },
    async (request) => {
        const callerUid = request.auth?.uid;
        console.log("updateReservationStatus called, uid:", callerUid);

        if (!callerUid) throw new HttpsError("unauthenticated", "Giriş gerekli.");
        await assertIsAdmin(callerUid);
        console.log("Admin check passed");

        const reservationId = String(request.data?.reservationId ?? "").trim();
        const status        = String(request.data?.status ?? "").trim();
        const rejectNote    = String(request.data?.rejectNote ?? "").trim();
        console.log("reservationId:", reservationId, "status:", status);

        if (!reservationId) throw new HttpsError("invalid-argument", "reservationId zorunlu.");
        if (!["confirmed", "rejected", "cancelled"].includes(status)) {
            throw new HttpsError("invalid-argument", "Geçersiz status.");
        }

        const snap        = await admin.database().ref(`reservations/${reservationId}`).get();
        const reservation = snap.val() as ReservationData | null;

        console.log("Reservation data:", JSON.stringify(reservation));
        if (!reservation) throw new HttpsError("not-found", "Rezervasyon bulunamadı.");

        await admin.database().ref(`reservations/${reservationId}/status`).set(status);
        console.log("Status updated to:", status);

        if (reservation.customerEmail?.includes("@")) {
            console.log("Sending mail to:", reservation.customerEmail);

            const mailLogKey  = `${reservationId}_${status}`;
            const mailLogRef  = admin.database().ref(`reservationMailLogs/${mailLogKey}`);
            const alreadySent = await mailLogRef.child("ok").get();

            if (alreadySent.val() === true) {
                console.log("Mail already sent, skipping.");
            } else {
                const subject =
                    status === "confirmed" ? "Rezervasyonunuz Onaylandı ✓" :
                        status === "cancelled" ? "Rezervasyonunuz İptal Edildi" :
                            "Rezervasyonunuz Reddedildi";

                const headerColor =
                    status === "confirmed" ? "#2e7d32" :
                        status === "cancelled" ? "#e65100" :
                            "#c62828";

                const message =
                    status === "confirmed" ? "Rezervasyonunuz onaylandı. Sizi bekliyoruz!" :
                        status === "cancelled" ? "Rezervasyonunuz iptal edilmiştir. Üzgünüz, başka bir zaman görüşmek dileğiyle." :
                            "Üzgünüz, rezervasyonunuz kabul edilemedi.";

                const footerMessage =
                    status === "confirmed" ? "Herhangi bir değişiklik için lütfen bizimle iletişime geçin." :
                        status === "cancelled" ? "Tekrar rezervasyon yapmak için sitemizi ziyaret edebilirsiniz." :
                            "Başka bir tarih veya saat için tekrar rezervasyon yapabilirsiniz.";

                const timeStr = reservation.endTime
                    ? `${reservation.time} – ${reservation.endTime}`
                    : reservation.time || "-";

                const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
            <h2 style="color:${headerColor};">${subject}</h2>
            <p>Merhaba <strong>${reservation.customerName || "Değerli Müşterimiz"}</strong>,</p>
            <p>${message}</p>
            <div style="padding:16px;border:1px solid #eee;border-radius:12px;margin:16px 0;">
              <p><strong>Tarih:</strong> ${reservation.date || "-"}</p>
              <p><strong>Saat:</strong> ${timeStr}</p>
              <p><strong>Kişi Sayısı:</strong> ${reservation.partySize || "-"}</p>
              ${reservation.note ? `<p><strong>Notunuz:</strong> ${reservation.note}</p>` : ""}
            </div>
            ${rejectNote ? `
            <div style="padding:16px;background:#fff8f8;border:1px solid #ffd0d0;border-radius:12px;margin:16px 0;">
              <p style="margin:0;"><strong>Mesajımız:</strong> ${rejectNote}</p>
            </div>` : ""}
            <p style="color:#555;">${footerMessage}</p>
          </div>`;

                const text = [
                    subject, "",
                    `Merhaba ${reservation.customerName},`, "",
                    message, "",
                    `Tarih: ${reservation.date}`,
                    `Saat: ${timeStr}`,
                    `Kişi: ${reservation.partySize}`,
                    rejectNote ? `\nMesajımız: ${rejectNote}` : "",
                    "", footerMessage,
                ].join("\n");

                const transporter = createMailTransporter();
                try {
                    await transporter.sendMail({
                        from: SMTP_FROM.value(),
                        to:   reservation.customerEmail,
                        subject, html, text,
                    });
                    console.log("Mail sent successfully to:", reservation.customerEmail);
                    await mailLogRef.set({ ok: true, to: reservation.customerEmail, sentAt: Date.now(), status });
                } catch (err: any) {
                    console.error("Mail send error:", err?.message, err);
                    await mailLogRef.set({ ok: false, error: err?.message, sentAt: Date.now(), status });
                }
            }
        } else {
            console.log("No valid email, skipping. Email value:", reservation.customerEmail);
        }

        return { ok: true };
    }
);

// ─── User Management ──────────────────────────────────────────────────────────

export const createUserWithProfile = onRequest(
    { region: "europe-west1" },
    async (req, res) => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") { res.status(204).send(""); return; }
        if (req.method !== "POST")    { res.status(405).json({ error: "Use POST" }); return; }

        try {
            const body = req.body as CreateUserBody;
            if (!body?.email || !body?.password || !body?.name) {
                res.status(400).json({ error: "email, password, name zorunlu" });
                return;
            }
            const userRecord = await admin.auth().createUser({
                email: body.email, password: body.password, displayName: body.name,
            });
            const uid     = userRecord.uid;
            const profile = { uid, email: body.email, name: body.name, createdAt: new Date().toISOString() };
            await admin.database().ref(`users/${uid}`).set(profile);
            res.status(200).json({ ok: true, uid, profile });
        } catch {
            res.status(500).json({ ok: false, error: "unknown error", code: null });
        }
    }
);

export const mintTableSession = onCall<MintReq, Promise<MintRes>>(
    { region: "europe-west1", cors: ALLOWED_ORIGINS },
    async (req) => {
        const data = req.data;
        if (!isNonEmptyString(data?.tableId) || !isNonEmptyString(data?.qrKey)) {
            throw new HttpsError("invalid-argument", "tableId ve qrKey zorunlu.");
        }
        const tableId  = data.tableId.trim();
        const qrKey    = data.qrKey.trim();
        const secretSnap = await admin.database().ref(`tableSecrets/${tableId}/qrKey`).get();
        const expected = secretSnap.val();
        if (!isNonEmptyString(expected) || expected !== qrKey) {
            throw new HttpsError("permission-denied", "Geçersiz QR anahtarı.");
        }
        const now          = Date.now();
        const exp          = now + 15 * 60 * 1000;
        const sessionToken = base64UrlToken(24);
        await admin.database().ref(`tableSessions/${tableId}/${sessionToken}`).set({ createdAtMs: now, exp });
        return { sessionToken, exp };
    }
);

export const getOrdersForTable = onCall<GetOrdersReq, Promise<GetOrdersRes>>(
    { region: "europe-west1", cors: ALLOWED_ORIGINS },
    async (req) => {
        const data = req.data;
        if (!isNonEmptyString(data?.tableId) || !isNonEmptyString(data?.sessionToken)) {
            throw new HttpsError("invalid-argument", "tableId ve sessionToken zorunlu.");
        }
        const tableId      = data.tableId.trim();
        const sessionToken = data.sessionToken.trim();
        const sessSnap     = await admin.database().ref(`tableSessions/${tableId}/${sessionToken}`).get();
        const sessVal      = sessSnap.val() as unknown;
        if (!sessVal || typeof sessVal !== "object") {
            throw new HttpsError("permission-denied", "Session bulunamadı.");
        }
        const exp = (sessVal as { exp?: unknown }).exp;
        if (typeof exp !== "number" || exp <= Date.now()) {
            throw new HttpsError("permission-denied", "Session süresi dolmuş.");
        }
        const ordersSnap = await admin.database().ref(`ordersByTable/${tableId}/${sessionToken}`).get();
        const ordersVal  = ordersSnap.val() as unknown;
        if (ordersVal && typeof ordersVal === "object") {
            return { orders: ordersVal as Record<string, unknown> };
        }
        return { orders: null };
    }
);

export const adminCreateUser = onCall(
    { region: "europe-west1", cors: ALLOWED_ORIGINS },
    async (request) => {
        const callerUid = request.auth?.uid;
        if (!callerUid) throw new HttpsError("unauthenticated", "Giriş gerekli.");
        await assertIsAdmin(callerUid);
        const name     = String(request.data?.name ?? "").trim();
        const email    = String(request.data?.email ?? "").trim();
        const password = String(request.data?.password ?? "");
        const userType = String(request.data?.userType ?? "").trim();
        const isAdmin  = Boolean(request.data?.isAdmin);
        if (!name || !email || !password || !userType) {
            throw new HttpsError("invalid-argument", "Eksik alan var.");
        }
        const userRecord = await admin.auth().createUser({ email, password, displayName: name });
        const uid        = userRecord.uid;
        await admin.database().ref(`users/${uid}`).set({
            uid, name, email, userType, isAdmin, createdAt: new Date().toISOString(),
        });
        return { uid };
    }
);

export const adminSetPassword = onCall(
    { region: "europe-west1", cors: ALLOWED_ORIGINS },
    async (request) => {
        const callerUid = request.auth?.uid;
        if (!callerUid) throw new HttpsError("unauthenticated", "Giriş gerekli.");
        await assertIsAdmin(callerUid);
        const uid         = String(request.data?.uid ?? "").trim();
        const newPassword = String(request.data?.newPassword ?? "").trim();
        if (!uid || !newPassword) throw new HttpsError("invalid-argument", "Eksik alan var.");
        await admin.auth().updateUser(uid, { password: newPassword });
        return { ok: true as const };
    }
);

export const adminDeleteUser = onCall(
    { region: "europe-west1", cors: ALLOWED_ORIGINS },
    async (request) => {
        try {
            const callerUid = request.auth?.uid;
            if (!callerUid) throw new HttpsError("unauthenticated", "Giriş gerekli.");
            await assertIsAdmin(callerUid);
            const uid = String(request.data?.uid ?? "").trim();
            if (!uid) throw new HttpsError("invalid-argument", "uid gerekli.");
            await admin.auth().revokeRefreshTokens(uid);
            await admin.auth().deleteUser(uid);
            return { ok: true as const };
        } catch (err: any) {
            console.error("adminDeleteUser failed:", err);
            if (err instanceof HttpsError) throw err;
            throw new HttpsError("internal", err?.message || "Unknown error");
        }
    }
);

// ─── Order Mail Triggers ──────────────────────────────────────────────────────
export const sendOrderMailOnCreateDirect = onValueCreated(
    {
        ref: "/ordersByTable/{tableId}/{orderId}",
        region: "europe-west1",
        secrets: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM],
    },
    async (event) => {
        const tableId = event.params.tableId as string;
        const orderId = event.params.orderId as string;
        const order   = event.data?.val() as OrderPayload | null;
        await sendOrderMailInternal({ tableId, orderId, order });
    }
);

export const sendOrderMailOnCreateSession = onValueCreated(
    {
        ref: "/ordersByTable/{tableId}/{sessionToken}/{orderId}",
        region: "europe-west1",
        secrets: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM],
    },
    async (event) => {
        const tableId = event.params.tableId as string;
        const orderId = event.params.orderId as string;
        const order   = event.data?.val() as OrderPayload | null;
        await sendOrderMailInternal({ tableId, orderId, order });
    }
);
