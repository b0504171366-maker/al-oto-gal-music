/* Service Worker — מאפשר התקנה כאפליקציה ועבודה גם בלי רשת.
   -------------------------------------------------------------------
   חשוב: ה-HTML (וה-manifest) נטענים ברשת-תחילה (network-first). גרסה
   שמגישה מטמון-תחילה עם שם מטמון קבוע נתקעת לנצח על הגרסה הראשונה
   שנשמרה — והמשחק "עובד רק באינקוגניטו". אל תחזירו את ההתנהגות הזו.

   שם המטמון ייחודי לאפליקציה הזו (קשר משפחתי) כדי לא להתנגש עם
   ה-Service Worker של "על אותו גל" שמוגש מהנתיב המקביל /app/.
   בכל פרסום של גרסה חדשה — להעלות את המספר ב-CACHE.
*/
const CACHE = 'kesher-v1';
const CACHE_PREFIX = 'kesher-';
const SHELL = ['./', './index.html', './manifest.webmanifest',
               './icon-192.png', './icon-512.png', './icon-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .catch(()=>{})          // קובץ חסר לא ימנע התקנה
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      // מוחקים רק מטמונים ישנים של האפליקציה הזו (לפי קידומת kesher-),
      // ולא נוגעים במטמון של "על אותו גל" (al-oto-gal-v4) שחי באותו דומיין
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  const isPage = req.mode === 'navigate' ||
                 /\.(html|webmanifest)$/i.test(url.pathname) ||
                 url.pathname.endsWith('/');

  if (isPage){
    // רשת תחילה: תמיד מקבלים את הגרסה העדכנית כשיש חיבור
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok && url.origin === location.origin){
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // נכסים סטטיים: מטמון תחילה, ורענון ברקע לפעם הבאה
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res && res.ok && url.origin === location.origin){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
