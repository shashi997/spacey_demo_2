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
  apiKey: "AIzaSyDuKet3l3ytGUFezA7RYoES_G92qdn4yf8",
  authDomain: "spacey-demo.firebaseapp.com",
  projectId: "spacey-demo",
  storageBucket: "spacey-demo.firebasestorage.app",
  messagingSenderId: "904680653040",
  appId: "1:904680653040:web:e0bfb8dc70216e4dcfc235",
  measurementId: "G-TV6WZNTRT7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
// const analytics = getAnalytics(app);
export const db = getFirestore(app);