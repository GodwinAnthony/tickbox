/* ============================================================
   TickBox cloud save — "Sign in with Google" (Firebase Auth +
   Firestore). Presentations are stored per Google account at
   users/{uid}/decks/{deckId}, so they show up on any laptop.
   The browser copy (localStorage) stays as an offline cache.
   ============================================================ */
const FIREBASE_CONFIG = null; // filled in once the Firebase project exists

const V = '10.12.2';
const listeners = new Set();
let auth = null, db = null, fs = null, au = null, user = null;

const api = {
  available: !!FIREBASE_CONFIG,
  get user() { return user; },
  onChange(fn) { listeners.add(fn); fn(user); return () => listeners.delete(fn); },
  async signIn() {
    await ready;
    const provider = new au.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try { await au.signInWithPopup(auth, provider); }
    catch (e) {
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) return au.signInWithRedirect(auth, provider);
      if (e && e.code === 'auth/popup-closed-by-user') return;
      throw e;
    }
  },
  async signOut() { await ready; return au.signOut(auth); },
  // [{ id, updated, deleted, deck }]
  async list() {
    await ready; if (!user) return [];
    const snap = await fs.getDocs(fs.collection(db, 'users', user.uid, 'decks'));
    return snap.docs.map(d => {
      const x = d.data();
      let deck = null;
      try { deck = x.data ? JSON.parse(x.data) : null; } catch (_) {}
      return { id: d.id, updated: x.updated || 0, deleted: !!x.deleted, deck };
    });
  },
  async save(deck) {
    await ready; if (!user || !deck || !deck.id) return;
    const clean = { ...deck }; delete clean.fresh;
    await fs.setDoc(fs.doc(db, 'users', user.uid, 'decks', deck.id), {
      title: String(deck.title || '').slice(0, 120), updated: deck.updated || Date.now(), deleted: false, data: JSON.stringify(clean),
    });
  },
  // a "tombstone" so other laptops also drop it instead of uploading it again
  async remove(id) {
    await ready; if (!user || !id) return;
    await fs.setDoc(fs.doc(db, 'users', user.uid, 'decks', id), { updated: Date.now(), deleted: true, data: '' });
  },
  async saveResults(all) {
    await ready; if (!user) return;
    await fs.setDoc(fs.doc(db, 'users', user.uid, 'meta', 'results'), { data: JSON.stringify(all || {}), updated: Date.now() });
  },
  async loadResults() {
    await ready; if (!user) return null;
    const d = await fs.getDoc(fs.doc(db, 'users', user.uid, 'meta', 'results'));
    if (!d.exists()) return null;
    try { return JSON.parse(d.data().data || '{}'); } catch (_) { return null; }
  },
};

const ready = (async () => {
  if (!FIREBASE_CONFIG) return;
  const base = `https://www.gstatic.com/firebasejs/${V}/`;
  const [app, a, f] = await Promise.all([
    import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js'),
  ]);
  au = a; fs = f;
  const fb = app.initializeApp(FIREBASE_CONFIG);
  auth = a.getAuth(fb);
  db = f.getFirestore(fb);
  await a.setPersistence(auth, a.browserLocalPersistence);
  a.onAuthStateChanged(auth, u => {
    user = u ? { uid: u.uid, name: u.displayName || u.email || 'You', email: u.email || '', photo: u.photoURL || '' } : null;
    listeners.forEach(fn => { try { fn(user); } catch (e) { console.error(e); } });
  });
})().catch(e => { console.error('TickBox cloud failed to load', e); api.available = false; listeners.forEach(fn => fn(null)); });

window.TBCloud = api;
window.dispatchEvent(new Event('tbcloud'));
