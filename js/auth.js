import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const app = initializeApp({
  apiKey: "AIzaSyBK_X3RB1WJWf-iS2Rye6E6d3m8zyMB52k",
  authDomain: "petgamemultiplayer.firebaseapp.com",
  projectId: "petgamemultiplayer",
  storageBucket: "petgamemultiplayer.firebasestorage.app",
  messagingSenderId: "453104531454",
  appId: "1:453104531454:web:ff125e353d4d553ed4b2af"
});
const auth = getAuth(app);

const msg = document.getElementById('msg');
const showMsg = (t, c) => { msg.textContent = t; msg.className = 'msg ' + c; };

onAuthStateChanged(auth, (user) => { if (user) location.href = 'game.html'; });

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (username.length < 3) return showMsg('❌ İsim en az 3 karakter olmalı!', 'error');
  if (password.length < 6) return showMsg('❌ Şifre en az 6 karakter olmalı!', 'error');

  localStorage.setItem('petgame_username', username);
  const email = username.toLowerCase().replace(/\s/g, '') + '@petgame.com';
  showMsg('⏳ Kontrol ediliyor...', 'info');

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    if (['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(err.code)) {
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch (err2) {
        if (err2.code === 'auth/email-already-in-use') showMsg('❌ Bu isim kayıtlı ama şifre yanlış!', 'error');
        else showMsg('❌ ' + err2.code, 'error');
      }
    } else if (err.code === 'auth/wrong-password') showMsg('❌ Şifre yanlış!', 'error');
    else if (err.code === 'auth/too-many-requests') showMsg('⏳ Çok deneme yaptın, 1 dk bekle!', 'error');
    else showMsg('❌ ' + err.code, 'error');
  }
});
