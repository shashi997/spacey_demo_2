// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth"; // For Authentication
import { getFirestore } from "firebase/firestore"; // For Firestore
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAGOzqKIhd5rStoszL135j-RsxdRhYluaY",
  authDomain: "spaceyapp-7c7f1.firebaseapp.com",
  projectId: "spaceyapp-7c7f1",
  storageBucket: "spaceyapp-7c7f1.firebasestorage.app",
  messagingSenderId: "696302679606",
  appId: "1:696302679606:web:47460b00a0c912bb00ca97",
  measurementId: "G-QTJ1L1SXRG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
// const analytics = getAnalytics(app);
export const db = getFirestore(app);