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

export { paySelection } from "./paySelected";

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

function buildOrderMail(orderId: string, tableId: string, order: OrderPayload) {
    const items = Array.isArray(order.items) ? order.items : [];
    const total = Number(order.total || 0);
    const publicOrderNo = typeof order.publicOrderNo === "number" ? order.publicOrderNo : null;

    const subject = publicOrderNo
        ? `Siparişiniz alındı #${publicOrderNo}`
        : "Siparişiniz alındı";

    const textLines: string[] = [];
    textLines.push("Siparişiniz başarıyla oluşturuldu.");
    textLines.push("");
    textLines.push(`Sipariş ID: ${orderId}`);
    if (publicOrderNo) textLines.push(`Takip Numarasi: ${publicOrderNo}`);
    textLines.push(`Oluşturan: Paket Servis`);
    textLines.push("");
    textLines.push("Ürünler:");

    for (const item of items) {
        const qty = Number(item.qty || 1);
        const title = String(item.title || "");
        const note = String(item.note || "");
        const unitPrice = Number(item.unitPrice || 0);

        textLines.push(`- ${qty}x ${title} (${formatPriceEUR(unitPrice)})`);
        if (note) textLines.push(`  Not: ${note}`);
    }

    textLines.push("");
    textLines.push(`Toplam: ${formatPriceEUR(total)}`);

    const itemsHtml = items
        .map((item) => {
            const qty = Number(item.qty || 1);
            const title = String(item.title || "");
            const note = String(item.note || "");
            const unitPrice = Number(item.unitPrice || 0);

            return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${qty}x</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">
            ${title}
            ${note ? `<br/><small>Not: ${note}</small>` : ""}
          </td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${formatPriceEUR(unitPrice)}</td>
        </tr>
      `;
        })
        .join("");

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color:#111; max-width:700px; margin:0 auto; padding:24px;">
        <h2 style="margin-bottom:8px;">Siparişiniz alındı</h2>
        <p>Siparişiniz başarıyla oluşturuldu.</p>

        <div style="margin:16px 0; padding:16px; border:1px solid #eee; border-radius:12px;">
          <p><strong>Sipariş ID:</strong> ${orderId}</p>
          ${publicOrderNo ? `<p><strong>Takip Numarasi:</strong> ${publicOrderNo}</p>` : ""}
          <p><strong>Oluşturan:</strong>Paket Servis</p>
        </div>

        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th align="left" style="padding:8px;border-bottom:2px solid #ddd;">Adet</th>
              <th align="left" style="padding:8px;border-bottom:2px solid #ddd;">Ürün</th>
              <th align="left" style="padding:8px;border-bottom:2px solid #ddd;">Fiyat</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <h3 style="margin-top:20px;">Toplam: ${formatPriceEUR(total)}</h3>
      </div>
    `;

    return {
        subject,
        text: textLines.join("\n"),
        html,
    };
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

    const mailLogRef = admin.database().ref(`mailLogs/${orderId}`);

    const alreadySentSnap = await mailLogRef.child("ok").get();
    if (alreadySentSnap.exists() && alreadySentSnap.val() === true) {
        return;
    }

    const transporter = createMailTransporter();
    const mail = buildOrderMail(orderId, tableId, order);

    try {
        await transporter.sendMail({
            from: SMTP_FROM.value(),
            to: order.customerEmail,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
        });

        await mailLogRef.set({
            ok: true,
            to: order.customerEmail,
            sentAt: Date.now(),
            type: "ORDER_CREATED",
        });
    } catch (err: any) {
        console.error("sendOrderMailInternal error:", err);

        await mailLogRef.set({
            ok: false,
            to: order.customerEmail,
            error: err?.message || "unknown error",
            sentAt: Date.now(),
            type: "ORDER_CREATED",
        });
    }
}

async function assertIsAdmin(callerUid: string): Promise<void> {
    const snap = await admin.database().ref(`users/${callerUid}/isAdmin`).get();
    if (snap.val() !== true) {
        throw new HttpsError("permission-denied", "Admin değil.");
    }
}

export const createUserWithProfile = onRequest(
    { region: "europe-west1" },
    async (req, res) => {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
            res.status(204).send("");
            return;
        }

        if (req.method !== "POST") {
            res.status(405).json({ error: "Use POST" });
            return;
        }

        try {
            const body = req.body as CreateUserBody;

            if (!body?.email || !body?.password || !body?.name) {
                res.status(400).json({ error: "email, password, name zorunlu" });
                return;
            }

            const userRecord = await admin.auth().createUser({
                email: body.email,
                password: body.password,
                displayName: body.name,
            });

            const uid = userRecord.uid;

            const profile = {
                uid,
                email: body.email,
                name: body.name,
                createdAt: new Date().toISOString(),
            };

            await admin.database().ref(`users/${uid}`).set(profile);

            res.status(200).json({ ok: true, uid, profile });
        } catch (e) {
            res.status(500).json({
                ok: false,
                error: "unknown error",
                code: null,
            });
        }
    }
);

export const mintTableSession = onCall<MintReq, Promise<MintRes>>(
    {
        region: "europe-west1",
        cors: ALLOWED_ORIGINS,
    },
    async (req) => {
        const data = req.data;

        if (!isNonEmptyString(data?.tableId) || !isNonEmptyString(data?.qrKey)) {
            throw new HttpsError("invalid-argument", "tableId ve qrKey zorunlu.");
        }

        const tableId = data.tableId.trim();
        const qrKey = data.qrKey.trim();

        const secretSnap = await admin.database().ref(`tableSecrets/${tableId}/qrKey`).get();
        const expected = secretSnap.val();

        if (!isNonEmptyString(expected) || expected !== qrKey) {
            throw new HttpsError("permission-denied", "Geçersiz QR anahtarı.");
        }

        const now = Date.now();
        const exp = now + 15 * 60 * 1000;
        const sessionToken = base64UrlToken(24);

        await admin.database().ref(`tableSessions/${tableId}/${sessionToken}`).set({
            createdAtMs: now,
            exp,
        });

        return { sessionToken, exp };
    }
);

export const getOrdersForTable = onCall<GetOrdersReq, Promise<GetOrdersRes>>(
    {
        region: "europe-west1",
        cors: ALLOWED_ORIGINS,
    },
    async (req) => {
        const data = req.data;

        if (!isNonEmptyString(data?.tableId) || !isNonEmptyString(data?.sessionToken)) {
            throw new HttpsError("invalid-argument", "tableId ve sessionToken zorunlu.");
        }

        const tableId = data.tableId.trim();
        const sessionToken = data.sessionToken.trim();

        const sessSnap = await admin.database().ref(`tableSessions/${tableId}/${sessionToken}`).get();
        const sessVal = sessSnap.val() as unknown;

        if (!sessVal || typeof sessVal !== "object") {
            throw new HttpsError("permission-denied", "Session bulunamadı.");
        }

        const exp = (sessVal as { exp?: unknown }).exp;
        if (typeof exp !== "number" || exp <= Date.now()) {
            throw new HttpsError("permission-denied", "Session süresi dolmuş.");
        }

        const ordersSnap = await admin.database().ref(`ordersByTable/${tableId}/${sessionToken}`).get();
        const ordersVal = ordersSnap.val() as unknown;

        if (ordersVal && typeof ordersVal === "object") {
            return { orders: ordersVal as Record<string, unknown> };
        }

        return { orders: null };
    }
);

export const adminCreateUser = onCall(
    {
        region: "europe-west1",
        cors: ALLOWED_ORIGINS,
    },
    async (request) => {
        const callerUid = request.auth?.uid;
        if (!callerUid) throw new HttpsError("unauthenticated", "Giriş gerekli.");

        await assertIsAdmin(callerUid);

        const name = String(request.data?.name ?? "").trim();
        const email = String(request.data?.email ?? "").trim();
        const password = String(request.data?.password ?? "");
        const userType = String(request.data?.userType ?? "").trim();
        const isAdmin = Boolean(request.data?.isAdmin);

        if (!name || !email || !password || !userType) {
            throw new HttpsError("invalid-argument", "Eksik alan var.");
        }

        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name,
        });

        const uid = userRecord.uid;

        await admin.database().ref(`users/${uid}`).set({
            uid,
            name,
            email,
            userType,
            isAdmin,
            createdAt: new Date().toISOString(),
        });

        return { uid };
    }
);

export const adminSetPassword = onCall(
    {
        region: "europe-west1",
        cors: ALLOWED_ORIGINS,
    },
    async (request) => {
        const callerUid = request.auth?.uid;
        if (!callerUid) throw new HttpsError("unauthenticated", "Giriş gerekli.");

        await assertIsAdmin(callerUid);

        const uid = String(request.data?.uid ?? "").trim();
        const newPassword = String(request.data?.newPassword ?? "").trim();

        if (!uid || !newPassword) {
            throw new HttpsError("invalid-argument", "Eksik alan var.");
        }

        await admin.auth().updateUser(uid, { password: newPassword });
        return { ok: true as const };
    }
);

export const adminDeleteUser = onCall(
    {
        region: "europe-west1",
        cors: ALLOWED_ORIGINS,
    },
    async (request) => {
        try {
            const callerUid = request.auth?.uid;
            if (!callerUid) throw new HttpsError("unauthenticated", "Giriş gerekli.");

            await assertIsAdmin(callerUid);

            const uid = String(request.data?.uid ?? "").trim();
            if (!uid) throw new HttpsError("invalid-argument", "uid gerekli.");

            await admin.auth().deleteUser(uid);
            return { ok: true as const };
        } catch (err: any) {
            console.error("adminDeleteUser failed:", err);
            if (err instanceof HttpsError) throw err;
            throw new HttpsError("internal", err?.message || "Unknown error");
        }
    }
);

export const sendOrderMailOnCreateDirect = onValueCreated(
    {
        ref: "/ordersByTable/{tableId}/{orderId}",
        region: "europe-west1",
        secrets: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM],
    },
    async (event) => {
        const tableId = event.params.tableId as string;
        const orderId = event.params.orderId as string;
        const order = event.data?.val() as OrderPayload | null;

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
        const order = event.data?.val() as OrderPayload | null;

        await sendOrderMailInternal({ tableId, orderId, order });
    }
);