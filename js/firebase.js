import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 🔥 SENİN FIREBASE CONFIG DEĞERLERİN
const firebaseConfig = {
  apiKey: "AIzaSyBK_X3RB1WJWf-iS2Rye6E6d3m8zyMB52k",
  authDomain: "petgamemultiplayer.firebaseapp.com",
  projectId: "petgamemultiplayer",
  storageBucket: "petgamemultiplayer.firebasestorage.app",
  messagingSenderId: "453104531454",
  appId: "1:453104531454:web:ff125e353d4d553ed4b2af"
};

// Firebase'i başlat
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// DOM elementleri
const loginBtn = document.getElementById('loginBtn');
const userStatus = document.getElementById('userStatus');

// Google ile giriş
loginBtn.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    try {
        userStatus.textContent = "⏳ Giriş yapılıyor...";
        userStatus.className = "waiting";
        
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Firestore'a oyuncu kaydı ekle
        await setDoc(doc(db, "players", user.uid), {
            name: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            lastLogin: new Date().toISOString(),
            petCount: 0,
            eggs: 1,
            coins: 100
        });
        
        userStatus.textContent = `✅ Hoşgeldin ${user.displayName}! Firestore'a kaydın eklendi.`;
        userStatus.className = "success";
        console.log("UID:", user.uid);
        
    } catch (error) {
        userStatus.textContent = `❌ Hata: ${error.message}`;
        userStatus.className = "error";
        console.error(error);
    }
});

// Otomatik giriş kontrolü
onAuthStateChanged(auth, (user) => {
    if (user) {
        userStatus.textContent = `✅ Zaten giriş yapmışsın: ${user.displayName}`;
        userStatus.className = "success";
    }
});
