import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import {getFunctions} from "firebase/functions";

const firebaseConfig = {
    apiKey: "AIzaSyDbXRh7foTai5quXx4FiDc8HedTZN8EcqM",
    authDomain: "lahmacunsefasidevelopment.firebaseapp.com",
    databaseURL: "https://lahmacunsefasidevelopment-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "lahmacunsefasidevelopment",
    storageBucket: "lahmacunsefasidevelopment.firebasestorage.app",
    messagingSenderId: "476913404427",
    appId: "1:476913404427:web:da8462bbc7a62f1d00950e",
    measurementId: "G-9Z1XSES6T9"
};
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export const functions = getFunctions(app, "europe-west1");
export { runTransaction } from "firebase/database";