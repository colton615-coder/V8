
const CACHE='colt-app-v1.9.0';
const CORE=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon-180.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE))); self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim();});
self.addEventListener('fetch',e=>{const url=new URL(e.request.url); if(url.origin===location.origin){e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{const cp=r.clone(); caches.open(CACHE).then(cc=>cc.put(e.request,cp)); return r;}).catch(()=>caches.match('./index.html'))));} else {e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));}});
