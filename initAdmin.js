import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

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
const auth = getAuth(app);
const db = getFirestore(app);

async function initSuperAdmin() {
  const email = "egihemanager@ksp.rw";
  const password = "KSPRwanda";
  const username = "egihemanager";

  try {
    // Try to sign in first to see if user exists
    console.log("Checking if superadmin exists...");
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log("User already exists. Ensuring Firestore data is correct...");
    
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      firstName: 'Super',
      lastName: 'Admin',
      username: username,
      email: email,
      role: 'superadmin',
      status: 'approved',
      createdAt: new Date().toISOString()
    }, { merge: true });
    
    console.log("Super Admin initialized successfully!");
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials') {
      console.log("User not found, creating new superadmin...");
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          firstName: 'Super',
          lastName: 'Admin',
          username: username,
          email: email,
          role: 'superadmin',
          status: 'approved',
          createdAt: new Date().toISOString()
        });
        console.log("Super Admin created successfully!");
        process.exit(0);
      } catch (createError) {
        console.error("Error creating user:", createError);
        process.exit(1);
      }
    } else {
      console.error("Error signing in:", error);
      process.exit(1);
    }
  }
}

initSuperAdmin();
