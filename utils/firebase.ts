import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBeqz09BX9tae_xHyRfkOw5oa10N1lMDt4",
  authDomain: "cppwapp-b12ab.firebaseapp.com",
  projectId: "cppwapp-b12ab",
  storageBucket: "cppwapp-b12ab.firebasestorage.app",
  messagingSenderId: "155276203186",
  appId: "1:155276203186:web:4cf8e090bc01a2694be5ab",
  measurementId: "G-Z4QBS9DB91"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);