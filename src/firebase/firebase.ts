import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import {getFunctions} from "firebase/functions";

const firebaseConfig = {
    apiKey: "AIzaSyC95nVCJ76YLvibA55OA86naEaK8BLquLw",
    authDomain: "restaurantorderwebdemo.firebaseapp.com",
    databaseURL: "https://restaurantorderwebdemo-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "restaurantorderwebdemo",
    storageBucket: "restaurantorderwebdemo.firebasestorage.app",
    messagingSenderId: "783104741879",
    appId: "1:783104741879:web:c8331bf9a6bae3d4fb5ef2",
    measurementId: "G-Y0X87DMYL3"
};
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export const functions = getFunctions(app, "europe-west1");
export { runTransaction } from "firebase/database";