import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBK_X3RB1WJWf-iS2Rye6E6d3m8zyMB52k",
  authDomain: "petgamemultiplayer.firebaseapp.com",
  projectId: "petgamemultiplayer",
  storageBucket: "petgamemultiplayer.firebasestorage.app",
  messagingSenderId: "453104531454",
  appId: "1:453104531454:web:ff125e353d4d553ed4b2af"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
