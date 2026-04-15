import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions(undefined, "europe-west1");

export const adminDeleteUserCallable = httpsCallable<{ uid: string }, { ok: true }>(
    functions,
    "adminDeleteUser"
);