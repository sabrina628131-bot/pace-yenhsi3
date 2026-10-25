const CACHE='campus-move-v6';
// Resolve every asset against the service worker's own scope, so the app works at / and at a subpath such as /pace-site/.
const SCOPE=self.registration.scope;
const ASSETS=['./','index.html','style.css','document.css','classroom.css','core.js','app.js','cloud-upload.js','mode.js','tiles.js','review.html','review.js','handout.html','guide.html','icon.svg','manifest.webmanifest','vendor/leaflet.js','vendor/leaflet.css'];
const ASSET_URLS=new Set(ASSETS.map(p=>new URL(p,SCOPE).href));
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll([...ASSET_URLS]))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('campus-move-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url)
