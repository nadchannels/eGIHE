import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBK83yW0kRjFJueQWE1wB6lY_urypo62LU",
  authDomain: "egihe-ksp.firebaseapp.com",
  projectId: "egihe-ksp",
  storageBucket: "egihe-ksp.firebasestorage.app",
  messagingSenderId: "138925704548",
  appId: "1:138925704548:web:b11d25ee6adbf209422671",
  measurementId: "G-NBWJF6BZN3"
};

const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const db = getFirestore(app);
const auth = getAuth(app);

export { app, analytics, db, auth };
