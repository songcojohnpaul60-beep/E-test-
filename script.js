/* ============================================================
   FIREBASE SETUP
   ============================================================
   PARA GUMANA ANG SHARED DATABASE:
   1. Pumunta sa https://console.firebase.google.com
   2. Click "Add project" → pangalanan (e.g. MinsuQuiz) → Continue
   3. Build → Realtime Database → Create database → Test mode → Enable
   4. Project Settings → General → Your apps → </> Web → Register
      → Kopyahin ang firebaseConfig
   5. Palitan ang mga value sa ibaba ng iyong sariling config
   ============================================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getDatabase, ref, set, get, push, remove, onValue, update
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

// ⬇⬇⬇ PALITAN ITO NG IYONG FIREBASE CONFIG ⬇⬇⬇
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL:       "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
// ⬆⬆⬆ PALITAN ITO NG IYONG FIREBASE CONFIG ⬆⬆⬆

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

/* ============================================================
   FIREBASE HELPERS — SCORES (shared, real-time, all devices)
   ============================================================ */
async function dbSaveScore(name, score) {
  const scoresRef = ref(db, 'scores');
  const snap = await get(scoresRef);
  const data = snap.val() || {};
  const key  = Object.keys(data).find(
    k => data[k].name.toLowerCase() === name.toLowerCase()
  );
  if (key) {
    if (score > data[key].score) await update(ref(db, `scores/${key}`), { score });
  } else {
    await push(scoresRef, { name, score, ts: Date.now() });
  }
}

function dbListenScores(callback) {
  onValue(ref(db, 'scores'), snap => {
    const data = snap.val() || {};
    const arr  = Object.entries(data).map(([k, v]) => ({ key: k, ...v }));
    arr.sort((a, b) => b.score - a.score);
    callback(arr);
  });
}

async function dbResetScores() {
  await set(ref(db, 'scores'), null);
}

/* ============================================================
   FIREBASE HELPERS — FEEDBACKS (write: all; read: admin only)
   ============================================================ */
async function dbPushFeedback(name, msg) {
  await push(ref(db, 'feedbacks'), {
    name, msg,
    date: new Date().toLocaleDateString('en-PH'),
    ts: Date.now()
  });
}

async function dbGetFeedbacks() {
  const snap = await get(ref(db, 'feedbacks'));
  const data = snap.val() || {};
  return Object.entries(data)
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => b.ts - a.ts);
}

async function dbDeleteFeedback(key) {
  await remove(ref(db, `feedbacks/${key}`));
}

/* ============================================================
   QUESTIONS — localStorage (admin-managed)
   ============================================================ */
const DB_QS = 'minsu_questions';
const defaultQs = [
  {q:"Ano ang tawag sa pinakamaliit na yunit ng wika?",                   a:["Ponema","Morpema","Sintaks","Diskurso"],                                                         c:0},
  {q:"Ano ang pag-aaral ng kahulugan ng salita?",                         a:["Ponolohiya","Semantika","Sintaks","Pragmatika"],                                                 c:1},
  {q:"Ano ang ayos ng pangungusap?",                                       a:["Sintaks","Diskurso","Ponema","Morpema"],                                                         c:0},
  {q:"Ano ang paraan ng pagbuo ng salita?",                                a:["Morpolohiya","Sintaks","Semantika","Ponolohiya"],                                                c:0},
  {q:"Ano ang tawag sa pangungusap na nagbibigay utos?",                   a:["Pautos","Patanong","Padamdam","Pasalaysay"],                                                     c:0},
  {q:"Ano ang pokus ng pandiwa na tumutukoy sa simuno?",                   a:["Pokus ng Aktor","Pokus ng Layon","Pokus ng Tagatanggap","Pokus ng Ganapan"],                     c:0},
  {q:"Ano ang tawag sa pag-aaral ng tunog ng wika?",                       a:["Ponolohiya","Semantika","Morpema","Sintaks"],                                                    c:0},
  {q:"Ano ang tawag sa pag-aaral ng kaayusan ng salita at pangungusap?",   a:["Sintaks","Semantika","Ponolohiya","Pragmatika"],                                                 c:0},
  {q:"Ano ang tawag sa paggamit ng wika sa lipunan?",                      a:["Pragmatika","Ponolohiya","Morpolohiya","Diskurso"],                                              c:0},
  {q:"Ano ang tawag sa pinakamalawak na yunit ng wika?",                   a:["Diskurso","Sintaks","Ponema","Morpema"],                                                         c:0},
  {q:"Ano ang tawag sa salita o yunit na may kahulugan?",                  a:["Morpema","Ponema","Sintaks","Diskurso"],                                                         c:0},
  {q:"Ano ang gamit ng pandiwa sa pangungusap?",                           a:["Nagpapahayag ng kilos","Nagpapakita ng tunog","Nagpapakita ng ayos","Nagpapahayag ng diskurso"],c:0},
  {q:"Ano ang tawag sa tanong na pangungusap?",                            a:["Patanong","Pautos","Pasalaysay","Padamdam"],                                                     c:0},
  {q:"Ano ang tawag sa pangungusap na nagpapahayag ng damdamin?",          a:["Padamdam","Pasalaysay","Pautos","Patanong"],                                                     c:0},
  {q:"Ano ang tawag sa pangungusap na nagsasalaysay?",                     a:["Pasalaysay","Padamdam","Pautos","Patanong"],                                                     c:0}
];
function getQs()     { try { const s = localStorage.getItem(DB_QS); return s ? JSON.parse(s) : defaultQs; } catch(e) { return defaultQs; } }
function saveQs(arr) { localStorage.setItem(DB_QS, JSON.stringify(arr)); }

/* ============================================================
   STATE
   ============================================================ */
const ADMIN_PASS = 'admin123';
let isAdmin = false;

/* ============================================================
   TOAST
   ============================================================ */
let toastTimer;
function toast(m) {
  const e = document.getElementById('toast');
  e.textContent = m;
  e.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => e.classList.remove('show'), 2800);
}

/* ============================================================
   NAV
   ============================================================ */
function goTab(id) {
  document.querySelectorAll('.link').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  const lnk = document.querySelector(`.link[data-tab="${id}"]`);
  if (lnk) lnk.classList.add('active');
  const tab = document.getElementById(id);
  if (tab) tab.classList.add('active');
  closeMenu();
  window.scrollTo(0, 0);
}

function toggleMenu() {
  document.getElementById('hamburger').classList.toggle('open');
  document.getElementById('navDrawer').classList.toggle('open');
}
function closeMenu() {
  document.getElementById('hamburger').classList.remove('open');
  document.getElementById('navDrawer').classList.remove('open');
}

document.getElementById('hamburger').addEventListener('click', toggleMenu);

document.querySelectorAll('.link').forEach(l => {
  l.addEventListener('click', () => goTab(l.dataset.tab));
});

/* ============================================================
   PARTICLES
   ============================================================ */
const cvs = document.getElementById('particles');
const ctx = cvs.getContext('2d');
function rsz() { cvs.width = window.innerWidth; cvs.height = window.innerHeight; }
rsz(); window.addEventListener('resize', rsz);
const pts = Array.from({ length: 55 }, () => ({
  x: Math.random() * cvs.width, y: Math.random() * cvs.height,
  r: Math.random() * 3 + 1, dx: Math.random() - .5, dy: Math.random() - .5
}));
(function loop() {
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  pts.forEach(p => {
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,166,81,0.2)'; ctx.fill();
    p.x += p.dx; p.y += p.dy;
    if (p.x < 0 || p.x > cvs.width) p.dx *= -1;
    if (p.y < 0 || p.y > cvs.height) p.dy *= -1;
  });
  requestAnimationFrame(loop);
})();

/* ============================================================
   SOUNDS
   ============================================================ */
const sOk  = new Audio('https://www.soundjay.com/buttons/sounds/button-3.mp3');
const sBad = new Audio('https://www.soundjay.com/buttons/sounds/button-10.mp3');

/* ============================================================
   GAME
   ============================================================ */
let qs = [], qi = 0, sc = 0, tmr = null, tL = 10, player = '';

function shArr(a) { return [...a].sort(() => Math.random() - .5); }

function mkQ(q) {
  const p = q.a.map((a, i) => ({ a, ok: i === q.c }));
  const s = shArr(p);
  return { q: q.q, a: s.map(x => x.a), c: s.findIndex(x => x.ok) };
}

function startGame() {
  player = document.getElementById('playerName').value.trim();
  if (!player) return toast('⚠️ Ilagay ang iyong pangalan!');
  const allQs = getQs();
  qs = shArr(allQs).map(mkQ);   // all questions, shuffled
  qi = 0; sc = 0;
  document.getElementById('score').textContent = 0;
  goTab('play');
  loadQ();
}

function loadQ() {
  clearInterval(tmr); tL = 10;
  const b = document.getElementById('bar');
  b.style.width = '100%'; b.classList.remove('danger');
  document.getElementById('q').textContent = qs[qi].q;
  document.getElementById('progress').textContent = `Tanong ${qi + 1} / ${qs.length}`;
  const ansDiv = document.getElementById('ans');
  ansDiv.innerHTML = '';
  qs[qi].a.forEach((c, i) => {
    const btn = document.createElement('button');
    btn.textContent = c;
    btn.addEventListener('click', () => chk(i, btn));
    ansDiv.appendChild(btn);
  });
  tmr = setInterval(() => {
    tL--;
    document.getElementById('bar').style.width = (tL * 10) + '%';
    if (tL <= 3) { document.getElementById('bar').classList.add('danger'); shk('gameBox'); }
    if (tL <= 0) nxtQ();
  }, 1000);
}

function chk(i, btn) {
  clearInterval(tmr);
  if (i === qs[qi].c) { sc++; btn.style.background = '#00e87a'; sOk.play(); }
  else { btn.style.background = '#ff4d4d'; sBad.play(); }
  document.getElementById('score').textContent = sc;
  document.getElementById('ans').querySelectorAll('button').forEach((b, j) => {
    if (j === qs[qi].c) b.style.background = '#00e87a';
    b.disabled = true;
  });
  setTimeout(nxtQ, 700);
}

function nxtQ() {
  qi++;
  if (qi < qs.length) {
    loadQ();
  } else {
    clearInterval(tmr);
    dbSaveScore(player, sc)
      .then(() => {
        toast(`🎉 Tapos na! Score: ${sc}/${qs.length}`);
        setTimeout(() => goTab('leader'), 1200);
      })
      .catch(() => {
        toast(`🎉 Tapos na! Score: ${sc}/${qs.length}`);
        setTimeout(() => goTab('leader'), 1200);
      });
  }
}

function shk(id) {
  const e = document.getElementById(id);
  e.classList.add('shake');
  setTimeout(() => e.classList.remove('shake'), 300);
}

document.getElementById('startBtn').addEventListener('click', startGame);

/* ============================================================
   LEADERBOARD — real-time from Firebase, visible to ALL users
   ============================================================ */
function loadBoard() {
  const loadingEl = document.getElementById('leaderLoading');
  const list      = document.getElementById('leaderboard');
  dbListenScores(players => {
    if (loadingEl) loadingEl.style.display = 'none';
    list.innerHTML = '';
    const m = ['🥇', '🥈', '🥉'];
    if (!players.length) {
      list.innerHTML = '<li style="justify-content:center;color:#aaa;font-size:14px;display:flex;">Walang scores pa. Maglaro muna!</li>';
      return;
    }
    players.forEach((p, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="rank">${m[i] || '#' + (i + 1)}</span><span class="pname">${p.name}</span><span class="pts">${p.score} pts</span>`;
      list.appendChild(li);
    });
  });
}

document.getElementById('goAdminBtn').addEventListener('click', () => goTab('admin'));
document.getElementById('adminResetBtn').addEventListener('click', adminReset);

/* ============================================================
   ADMIN
   ============================================================ */
function doAdminLogin() {
  if (document.getElementById('adminPass').value === ADMIN_PASS) {
    isAdmin = true;
    document.getElementById('adminGate').style.display     = 'none';
    document.getElementById('adminDash').style.display     = 'block';
    document.querySelector('.admin-nav-link').classList.add('show');
    document.getElementById('adminResetBtn').style.display = 'inline-flex';
    document.getElementById('adminFbView').style.display   = 'block';
    document.getElementById('feedbackThankYou').style.display = 'none';
    loadAdminFbList();
    loadFbList();
    renderQList();
    renderNewAnsFields();
    toast('✅ Admin login successful!');
  } else {
    toast('❌ Maling password!');
    document.getElementById('adminPass').value = '';
  }
}

function adminLogout() {
  isAdmin = false;
  document.getElementById('adminGate').style.display     = 'block';
  document.getElementById('adminDash').style.display     = 'none';
  document.querySelector('.admin-nav-link').classList.remove('show');
  document.getElementById('adminResetBtn').style.display = 'none';
  document.getElementById('adminFbView').style.display   = 'none';
  document.getElementById('feedbackThankYou').style.display = 'block';
  document.getElementById('adminPass').value = '';
  goTab('home');
  toast('Logged out sa admin.');
}

function adminReset() {
  if (!confirm('Reset lahat ng scores?')) return;
  dbResetScores().then(() => toast('🗑 Scores na-reset!'));
}

document.getElementById('adminLoginBtn').addEventListener('click', doAdminLogin);
document.getElementById('adminPass').addEventListener('keyup', e => { if (e.key === 'Enter') doAdminLogin(); });
document.getElementById('adminLogoutBtn').addEventListener('click', adminLogout);
document.getElementById('adminResetBtn2').addEventListener('click', adminReset);

/* ============================================================
   QUESTION MANAGER
   ============================================================ */
function renderQList() {
  const qArr = getQs();
  const div  = document.getElementById('qList');
  div.innerHTML = '';
  qArr.forEach((q, qi) => {
    const card = document.createElement('div');
    card.className = 'q-card';
    let aHtml = q.a.map((a, ai) => `
      <div class="ans-row">
        <input type="radio" name="cr_${qi}" value="${ai}" id="cr_${qi}_${ai}" ${q.c === ai ? 'checked' : ''}>
        <label for="cr_${qi}_${ai}" class="correct-lbl">✓</label>
        <input type="text" id="qa_${qi}_${ai}" value="${a}" placeholder="Answer ${ai + 1}">
      </div>`).join('');
    card.innerHTML = `<div class="q-num">Q${qi + 1}</div>
      <input type="text" style="font-size:13px;margin-bottom:8px;" id="qt_${qi}" value="${q.q}" placeholder="Tanong...">
      ${aHtml}
      <div class="q-actions">
        <button class="btn sm save-q" data-qi="${qi}">💾 Save</button>
        <button class="btn sm grey shf-q" data-qi="${qi}">🔀 Shuffle</button>
        <button class="btn sm danger del-q" data-qi="${qi}">🗑</button>
      </div>`;
    div.appendChild(card);
  });

  // Attach events to dynamically created buttons
  div.querySelectorAll('.save-q').forEach(b => b.addEventListener('click', () => saveQ(+b.dataset.qi)));
  div.querySelectorAll('.shf-q').forEach(b => b.addEventListener('click', () => shfQ(+b.dataset.qi)));
  div.querySelectorAll('.del-q').forEach(b => b.addEventListener('click', () => delQ(+b.dataset.qi)));
}

function saveQ(qi) {
  const qArr = getQs();
  qArr[qi].q = document.getElementById(`qt_${qi}`).value.trim();
  qArr[qi].a = qArr[qi].a.map((_, ai) => document.getElementById(`qa_${qi}_${ai}`).value.trim());
  const ch   = document.querySelector(`input[name="cr_${qi}"]:checked`);
  qArr[qi].c = ch ? parseInt(ch.value) : 0;
  saveQs(qArr); renderQList(); toast('✅ Nasave!');
}

function delQ(qi) {
  if (!confirm('Delete this question?')) return;
  const qArr = getQs(); qArr.splice(qi, 1); saveQs(qArr); renderQList(); toast('🗑 Deleted.');
}

function shfQ(qi) {
  const qArr = getQs();
  const p = qArr[qi].a.map((a, i) => ({ a, ok: i === qArr[qi].c }));
  const s = shArr(p);
  qArr[qi].a = s.map(x => x.a); qArr[qi].c = s.findIndex(x => x.ok);
  saveQs(qArr); renderQList(); toast(`🔀 Shuffled Q${qi + 1}`);
}

function shuffleAllAnswers() {
  let qArr = getQs();
  qArr = qArr.map(q => {
    const p = q.a.map((a, i) => ({ a, ok: i === q.c }));
    const s = shArr(p);
    return { q: q.q, a: s.map(x => x.a), c: s.findIndex(x => x.ok) };
  });
  saveQs(qArr); renderQList(); toast('🔀 Lahat na-shuffle!');
}

function renderNewAnsFields() {
  const w = document.getElementById('newAnsFields');
  w.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    w.innerHTML += `<div class="ans-entry">
      <input type="radio" name="newC" value="${i}" id="nc_${i}" ${i === 0 ? 'checked' : ''}>
      <label for="nc_${i}" style="font-size:13px;white-space:nowrap;">✓</label>
      <input type="text" id="na_${i}" placeholder="Answer ${i + 1}">
    </div>`;
  }
}

function addQuestion() {
  const qt = document.getElementById('newQText').value.trim();
  if (!qt) return toast('⚠️ Ilagay ang tanong!');
  const ans = [];
  for (let i = 0; i < 4; i++) {
    const v = document.getElementById(`na_${i}`).value.trim();
    if (!v) return toast(`⚠️ Punan ang Answer ${i + 1}!`);
    ans.push(v);
  }
  const c = parseInt(document.querySelector('input[name="newC"]:checked').value);
  const qArr = getQs();
  qArr.push({ q: qt, a: ans, c });
  saveQs(qArr);
  document.getElementById('newQText').value = '';
  renderNewAnsFields(); renderQList();
  toast('✅ Naidagdag ang tanong!');
}

document.getElementById('shuffleAllBtn').addEventListener('click', shuffleAllAnswers);
document.getElementById('addQBtn').addEventListener('click', addQuestion);

/* ============================================================
   FEEDBACK — lahat pwede mag-submit, admin lang makakabasa
   ============================================================ */
async function submitFeedback() {
  const name = document.getElementById('feedbackName').value.trim();
  const msg  = document.getElementById('feedbackMsg').value.trim();
  if (!name) return toast('⚠️ Ilagay ang pangalan!');
  if (!msg)  return toast('⚠️ Isulat ang feedback!');
  try {
    await dbPushFeedback(name, msg);
    document.getElementById('feedbackName').value = '';
    document.getElementById('feedbackMsg').value  = '';
    toast('✅ Salamat sa iyong feedback!');
    if (isAdmin) { loadFbList(); loadAdminFbList(); }
  } catch(e) {
    toast('❌ Hindi na-save. Check internet connection.');
  }
}

async function renderFbTo(listId) {
  const el = document.getElementById(listId);
  el.innerHTML = '<p class="fb-empty">Loading...</p>';
  try {
    const data = await dbGetFeedbacks();
    el.innerHTML = '';
    if (!data.length) { el.innerHTML = '<p class="fb-empty">Walang feedback pa.</p>'; return; }
    data.forEach(f => {
      const dv = document.createElement('div');
      dv.className = 'fb-item';
      const delBtn = document.createElement('button');
      delBtn.className = 'del-fb';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', () => delFb(f.key));
      const nameDiv = document.createElement('div');
      nameDiv.className = 'fb-name';
      nameDiv.innerHTML = `${f.name} <span style="font-weight:400;color:#aaa;font-size:12px;">· ${f.date}</span>`;
      const msgDiv = document.createElement('div');
      msgDiv.className = 'fb-msg';
      msgDiv.textContent = f.msg;
      dv.appendChild(delBtn);
      dv.appendChild(nameDiv);
      dv.appendChild(msgDiv);
      el.appendChild(dv);
    });
  } catch(e) {
    el.innerHTML = '<p class="fb-empty">Error loading feedbacks.</p>';
  }
}

function loadFbList()      { renderFbTo('feedbackList'); }
function loadAdminFbList() { renderFbTo('adminFbList'); }

async function delFb(key) {
  await dbDeleteFeedback(key);
  loadFbList(); loadAdminFbList(); toast('🗑 Deleted.');
}

document.getElementById('submitFbBtn').addEventListener('click', submitFeedback);

/* ============================================================
   INIT
   ============================================================ */
loadBoard();
renderNewAnsFields();