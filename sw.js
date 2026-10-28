/* THE SYSTEM - offline cache v7
   App files are network-first so a publish actually reaches phones.
   The previous cache-first path for programs.js/styles kept old programming forever.
   Firebase SDK scripts are cached too, so a signed-in plan still opens in the gym. */
const CACHE = "system-v7";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./programs.js", "./logic.js", "./migrate.js",
  "./plan.js", "./intake.js", "./cloud.js", "./intake-ui.js", "./manifest.json",
  "./icon-180.png", "./icon-512.png"
];
const FBJS = [
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"
];

function networkFirst(req){
  return fetch(req).then(r=>{
    const copy=r.clone();
    caches.open(CACHE).then(c=>c.put(req, copy)).catch(()=>{});
    return r;
  }).catch(()=>caches.match(req).then(h=>h || caches.match("./index.html")));
}

self.addEventListener("install", e=>{
  e.waitUntil(caches.open(CACHE).then(async c=>{
    await c.addAll(ASSETS);
    await Promise.all(FBJS.map(u=>c.add(u).catch(()=>{})));
  }).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(keys=>
    Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
  ).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=="GET") return;
  const firebaseJs = url.origin==="https://www.gstatic.com" && url.pathname.indexOf("/firebasejs/")>=0;
  if(!firebaseJs && url.origin!==self.location.origin) return;
  e.respondWith(networkFirst(e.request));
});
