import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, query, where, orderBy, limit, onSnapshot }
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ================= OYUN VERİLERİ ================= */
const RARITY_ORDER = ['common','rare','epic','legendary'];
const RARITIES = {
  common:    { name:'Sıradan',  income:1,  hatchMin:10 },
  rare:      { name:'Nadir',    income:3,  hatchMin:30 },
  epic:      { name:'Destansı', income:8,  hatchMin:120 },
  legendary: { name:'Efsanevi', income:20, hatchMin:360 }
};
const PET_TYPES = {
  common:    [{emoji:'🐤',name:'Civciv'},{emoji:'🐥',name:'Piliç'},{emoji:'🐦',name:'Serçe'}],
  rare:      [{emoji:'🐔',name:'Tavuk'},{emoji:'🦆',name:'Ördek'},{emoji:'🦃',name:'Hindi'}],
  epic:      [{emoji:'🦚',name:'Tavus Kuşu'},{emoji:'🦉',name:'Baykuş'},{emoji:'🦜',name:'Papağan'}],
  legendary: [{emoji:'🐉',name:'Ejderha'},{emoji:'🦄',name:'Unicorn'},{emoji:'🐲',name:'Anka'}]
};
const FOODS = {
  wheat: { emoji:'🌾', name:'Buğday',     price:5,   hunger:10, desc:'+10 Açlık' },
  corn:  { emoji:'🌽', name:'Mısır',      price:8,   hunger:20, desc:'+20 Açlık' },
  cake:  { emoji:'🍰', name:'Pasta',      price:15,  hunger:30, happy:10, desc:'+30 Açlık, +10 Mutluluk' },
  cosmic:{ emoji:'✨', name:'Kozmik Yem', price:500, desc:'MUTASYON! Peti üst nadirliğe dönüştürür' }
};
const CRATES = {
  normal:  { emoji:'📦', name:'Normal Kasa',  price:25,  odds:{common:70,rare:25,epic:4,legendary:1} },
  premium: { emoji:'🎁', name:'Premium Kasa', price:100, odds:{common:40,rare:40,epic:15,legendary:5} }
};

let me=null, myUid=null, myUsername='', pets=[], selectedPetId=null;
let petsLoaded=false, offlineDone=false;
const hatching = new Set();

/* ================= BAŞLANGIÇ ================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href='index.html'; return; }
  myUid = user.uid;
  const snap = await getDoc(doc(db,'players',myUid));
  if (!snap.exists()) await createNewPlayer();   // ilk giriş: hesap + bedava yumurta
  startGame();
});

async function createNewPlayer() {
  const uname = localStorage.getItem('petgame_username') || 'oyuncu';
  await setDoc(doc(db,'players',myUid), {
    username: uname, coins: 100, inventory: {}, lastIncome: Date.now(), createdAt: Date.now()
  });
  await addDoc(collection(db,'pets'), {   // 🥚 başlangıç yumurtası (5 dk)
    ownerId: myUid, isEgg: true, rarity: 'common',
    type: { emoji:'🐤', name:'Civciv' },
    hatchAt: Date.now() + 5*60*1000,
    hunger:100, happiness:100, hygiene:100, mutant:false, createdAt: Date.now()
  });
}

function startGame() {
  onSnapshot(doc(db,'players',myUid), (s) => {
    if (!s.exists()) return;
    me = s.data(); myUsername = me.username;
    document.getElementById('usernameLabel').textContent = myUsername;
    document.getElementById('coins').textContent = Math.floor(me.coins);
    renderInventory(); tryOfflineIncome();
  });

  onSnapshot(query(collection(db,'pets'), where('ownerId','==',myUid)), (s) => {
    pets = s.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b)=>a.createdAt-b.createdAt);
    if (!selectedPetId && pets.length) selectedPetId = pets[0].id;
    petsLoaded = true;
    renderPetList(); renderPetView(); tryOfflineIncome();
  });

  onSnapshot(query(collection(db,'chat'), orderBy('timestamp','asc'), limit(50)), (s) => {
    const box = document.getElementById('chatBox');
    box.innerHTML = s.docs.map(d => { const m=d.data();
      return `<div class="chat-msg"><b>${esc(m.username)}:</b> ${esc(m.message)}</div>`; }).join('');
    box.scrollTop = box.scrollHeight;
  });

  renderCrates(); renderMarket();
  setInterval(tickSecond, 1000);
  setInterval(tickMinute, 30000);
}

/* ================= GELİR SİSTEMİ ================= */
const petIncome = p => RARITIES[p.rarity].income * (p.mutant ? 2 : 1);

function tryOfflineIncome() {
  if (offlineDone || !me || !petsLoaded) return;
  offlineDone = true;
  const minutes = Math.min((Date.now()-(me.lastIncome||Date.now()))/60000, 480);
  const rate = pets.filter(p=>!p.isEgg && p.hunger>0).reduce((s,p)=>s+petIncome(p),0);
  const gained = Math.floor(minutes*rate);
  if (gained>0) { updateDoc(doc(db,'players',myUid), { coins:Math.floor(me.coins)+gained, lastIncome:Date.now() });
    toast(`😴 Sen yokken petlerin ${gained} 🪙 kazandı!`); }
  else updateDoc(doc(db,'players',myUid), { lastIncome:Date.now() }).catch(()=>{});
}

async function tickMinute() {
  if (!me) return;
  let income = 0;
  for (const p of pets) {
    if (p.isEgg) continue;
    if (p.hunger>0) income += petIncome(p);   // aç pet kazanmaz!
    updateDoc(doc(db,'pets',p.id), {
      hunger: Math.max(0,(p.hunger??100)-3),
      happiness: Math.max(0,(p.happiness??100)-2),
      hygiene: Math.max(0,(p.hygiene??100)-2)
    }).catch(()=>{});
  }
  if (income>0) updateDoc(doc(db,'players',myUid), { coins:Math.floor(me.coins)+income, lastIncome:Date.now() });
}

/* ================= YUMURTA SAYACI ================= */
function tickSecond() {
  const now = Date.now();
  document.querySelectorAll('[data-hatch]').forEach(el => {
    const t = parseInt(el.dataset.hatch);
    el.textContent = '⏳ ' + fmt(t-now);
    if (t<=now) { const pet = pets.find(p=>p.id===el.dataset.pet);
      if (pet && pet.isEgg && !hatching.has(pet.id)) { hatching.add(pet.id); hatch(pet); } }
  });
}
async function hatch(pet) {
  await updateDoc(doc(db,'pets',pet.id), { isEgg:false });
  toast(`🎉 Yumurta çatladı! ${pet.type.emoji} ${pet.type.name} aramıza katıldı!`);
}
function fmt(ms) { if (ms<=0) return '00:00'; const s=Math.floor(ms/1000);
  const h=Math.floor(s/3600), m=Math.floor(s%3600/60), ss=s%60;
  return (h?String(h).padStart(2,'0')+':':'')+String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0'); }

/* ================= GÖRÜNÜM ================= */
function renderPetList() {
  document.getElementById('petList').innerHTML = pets.map(p => {
    const sel = p.id===selectedPetId ? 'selected' : '';
    if (p.isEgg) return `<div class="pet-card ${sel} r-${p.rarity}" data-id="${p.id}">
      <div class="emoji">🥚</div><div><div class="pname">Yumurta</div>
      <div class="info" data-hatch="${p.hatchAt}" data-pet="${p.id}">⏳ --:--</div></div></div>`;
    return `<div class="pet-card ${sel} r-${p.rarity}" data-id="${p.id}">
      <div class="emoji">${p.mutant?'✨':''}${p.type.emoji}</div>
      <div><div class="pname">${esc(p.name||p.type.name)}</div>
      <div class="info">${RARITIES[p.rarity].name} • +${petIncome(p)}/dk</div></div></div>`;
  }).join('') || '<p style="color:#777">Henüz petin yok!</p>';
}

function renderPetView() {
  const p = pets.find(x=>x.id===selectedPetId);
  const v = document.getElementById('petView');
  if (!p) { v.innerHTML = '<p style="color:#777">Soldan bir pet seç!</p>'; return; }
  if (p.isEgg) {
    v.innerHTML = `<div class="big-emoji big-egg">🥚</div>
      <div class="pet-name">Gizemli Yumurta <span class="badge">${RARITIES[p.rarity].name}</span></div>
      <div class="hatch-timer" data-hatch="${p.hatchAt}" data-pet="${p.id}">⏳ --:--</div>
      <p style="color:#8899aa;font-size:12px;margin-top:8px">İçinden ne çıkacağını çatlayınca göreceksin! 👀</p>`;
    return;
  }
  const bar = (icon,val,color) => `<div class="bar-row"><span>${icon}</span>
    <div class="bar"><div class="bar-fill" style="width:${val}%;background:${color}"></div></div><span>${val}</span></div>`;
  v.innerHTML = `<div class="big-emoji ${p.mutant?'mutant':''}">${p.type.emoji}</div>
    <div class="pet-name">${p.mutant?'✨ ':''}${esc(p.name||p.type.name)}
      <span class="badge">${RARITIES[p.rarity].name}</span></div>
    <div class="income">+${petIncome(p)} 🪙 / dakika ${p.hunger<=0?'(AÇ! Besle 😱)':''}</div>
    <div class="bars">
      ${bar('🍗',p.hunger??100,'#ff9800')}
      ${bar('😊',p.happiness??100,'#ff5e78')}
      ${bar('🧼',p.hygiene??100,'#4fc3f7')}
    </div>`;
}

function renderInventory() {
  const inv = me?.inventory || {};
  document.getElementById('inventoryBar').innerHTML = Object.entries(inv)
    .filter(([k,n])=>n>0)
    .map(([k,n])=>`<button class="chip" data-food="${k}" title="${FOODS[k].desc}">${FOODS[k].emoji} x${n}</button>`).join('')
    || '<span style="color:#777;font-size:12px">Çanta boş. Marketten yemek al! 🛒</span>';
}

function renderCrates() {
  document.getElementById('crateArea').innerHTML = Object.entries(CRATES).map(([k,c]) =>
    `<div class="crate-card"><div class="crate-emoji">${c.emoji}</div>
     <div class="crate-name">${c.name}</div>
     <button class="small-btn" data-crate="${k}">${c.price} 🪙 Aç</button>
     <div class="odds">📊 %${c.odds.common} Sıradan • %${c.odds.rare} Nadir<br>%${c.odds.epic} Destansı • %${c.odds.legendary} Efsanevi<br>⏳ 10dk / 30dk / 2sa / 6sa</div></div>`).join('');
}

function renderMarket() {
  document.getElementById('marketList').innerHTML = Object.entries(FOODS).map(([k,f]) =>
    `<div class="market-item"><div><div class="mi-name">${f.emoji} ${f.name}</div>
     <div class="mi-desc">${f.desc}</div></div>
     <button class="small-btn" data-food="${k}">${f.price} 🪙</button></div>`).join('');
}

/* ================= OLAYLAR ================= */
document.getElementById('petList').addEventListener('click', e => {
  const c = e.target.closest('.pet-card'); if (!c) return;
  selectedPetId = c.dataset.id; renderPetList(); renderPetView();
});

document.getElementById('inventoryBar').addEventListener('click', e => {
  const c = e.target.closest('.chip'); if (c) feedPet(c.dataset.food);
});

document.getElementById('marketList').addEventListener('click', async e => {
  const b = e.target.closest('[data-food]'); if (!b) return;
  const f = FOODS[b.dataset.food];
  if (me.coins < f.price) return toast('❌ Yeterli coin yok!');
  const inv = me.inventory || {};
  await updateDoc(doc(db,'players',myUid), {
    coins: Math.floor(me.coins)-f.price, [`inventory.${b.dataset.food}`]: (inv[b.dataset.food]||0)+1 });
  toast(`${f.emoji} ${f.name} çantana eklendi!`);
});

document.getElementById('crateArea').addEventListener('click', async e => {
  const b = e.target.closest('[data-crate]'); if (!b) return;
  const c = CRATES[b.dataset.crate];
  if (me.coins < c.price) return toast('❌ Yeterli coin yok!');
  await updateDoc(doc(db,'players',myUid), { coins: Math.floor(me.coins)-c.price });
  const rarity = rollRarity(c.odds);
  const type = PET_TYPES[rarity][Math.floor(Math.random()*PET_TYPES[rarity].length)];
  await addDoc(collection(db,'pets'), {
    ownerId:myUid, isEgg:true, rarity, type,
    hatchAt: Date.now()+RARITIES[rarity].hatchMin*60000,
    hunger:100, happiness:100, hygiene:100, mutant:false, createdAt:Date.now() });
  toast(`${c.emoji} Kasadan ${RARITIES[rarity].name} yumurta çıktı! 🥚`);
});

async function feedPet(key) {
  const p = pets.find(x=>x.id===selectedPetId);
  if (!p) return toast('❌ Önce pet seç!');
  if (p.isEgg) return toast('🥚 Yumurta yemek yemez!');
  const inv = me.inventory || {};
  if (!inv[key]) return toast('❌ Bu yemekten yok!');
  await updateDoc(doc(db,'players',myUid), { [`inventory.${key}`]: inv[key]-1 });
  const f = FOODS[key];
  if (key==='cosmic') {   // 🧬 MUTASYON!
    const i = RARITY_ORDER.indexOf(p.rarity);
    if (i<3) {
      const nr = RARITY_ORDER[i+1];
      const nt = PET_TYPES[nr][Math.floor(Math.random()*PET_TYPES[nr].length)];
      await updateDoc(doc(db,'pets',p.id), { rarity:nr, type:nt, mutant:true, name:'Mutant '+nt.name });
      toast(`🧬 MUTASYON! ${p.type.name} → ${nt.emoji} Mutant ${nt.name} oldu!`);
    } else {
      await updateDoc(doc(db,'pets',p.id), { mutant:true });
      toast('🧬 MUTASYON! Efsanevi petin artık 2x gelirli! ✨');
    }
  } else {
    await updateDoc(doc(db,'pets',p.id), {
      hunger: Math.min(100,(p.hunger??0)+f.hunger),
      happiness: Math.min(100,(p.happiness??0)+(f.happy||0)) });
    toast(`${f.emoji} ${p.name||p.type.name} yemeğe bayıldı!`);
  }
}

document.getElementById('playBtn').addEventListener('click', async () => {
  const p = pets.find(x=>x.id===selectedPetId);
  if (!p || p.isEgg) return toast('❌ Önce bir pet seç!');
  await updateDoc(doc(db,'pets',p.id), { happiness: Math.min(100,(p.happiness??0)+15) });
  toast('⚽ Oynadınız! Mutluluk +15');
});
document.getElementById('washBtn').addEventListener('click', async () => {
  const p = pets.find(x=>x.id===selectedPetId);
  if (!p || p.isEgg) return toast('❌ Önce bir pet seç!');
  await updateDoc(doc(db,'pets',p.id), { hygiene: Math.min(100,(p.hygiene??0)+25) });
  toast('🧼 Tertemiz! Hijyen +25');
});

document.getElementById('marketBtn').addEventListener('click', ()=>document.getElementById('marketModal').classList.remove('hidden'));
document.getElementById('closeMarket').addEventListener('click', ()=>document.getElementById('marketModal').classList.add('hidden'));
document.getElementById('logoutBtn').addEventListener('click', ()=>signOut(auth));

document.getElementById('chatForm').addEventListener('submit', async e => {
  e.preventDefault();
  const inp = document.getElementById('chatInput');
  const t = inp.value.trim(); if (!t) return;
  inp.value='';
  await addDoc(collection(db,'chat'), { username:myUsername, message:t, timestamp:Date.now() });
});

/* ================= YARDIMCI ================= */
function rollRarity(odds) {
  const r = Math.random()*100; let acc=0;
  for (const k of RARITY_ORDER) { acc+=odds[k]; if (r<acc) return k; }
  return 'common';
}
let toastTimer;
function toast(t){ const el=document.getElementById('toast'); el.textContent=t;
  el.classList.remove('hidden'); clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.add('hidden'),3500); }
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
