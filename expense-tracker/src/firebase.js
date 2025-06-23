// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBWOaRM6RgB2B63wqHfawl7dMBU2uTMPbI",
  authDomain: "billybilly-8f5a5.firebaseapp.com",
  projectId: "billybilly-8f5a5",
  storageBucket: "billybilly-8f5a5.firebasestorage.app",
  messagingSenderId: "667395219625",
  appId: "1:667395219625:web:da57f0bb7b1319838349b8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;


// Default currency
export const DEFAULT_CURRENCY = 'CNY';

