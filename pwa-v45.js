'use strict';

const manifest = JSON.stringify({
  name: 'SüffIQ',
  short_name: 'SüffIQ',
  description: 'Multiplayer-Partyspiel für mehrere Handys – ohne Account.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#0d0914',
  theme_color: '#0d0914',
  orientation: 'portrait-primary',
  categories: ['games', 'entertainment'],
  icons: [
    { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
  ],
});

const icon = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8f5cff"/>
      <stop offset="1" stop-color="#5d31bf"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="118" fill="#0d0914"/>
  <rect x="54" y="54" width="404" height="404" rx="104" fill="url(#g)"/>
  <text x="256" y="316" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="190" font-weight="900" fill="#b8ff4a">IQ</text>
</svg>`;

const sw = `'use strict';
const CACHE='sueffiq-shell-v2';
const SHELL='/';
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await fetch(SHELL,{cache:'reload'});
      if(response&&response.ok)await cache.put(SHELL,response.clone());
    }catch(e){}
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||event.request.mode!=='navigate')return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const cached=await cache.match(SHELL);
    try{
      const response=await fetch(event.request);
      if(response&&response.ok)event.waitUntil(cache.put(SHELL,response.clone()).catch(()=>{}));
      return response;
    }catch(e){
      if(cached)return cached;
      return new Response('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0d0914"><title>SüffIQ</title></head><body style="margin:0;background:#0d0914;color:#fff;font-family:system-ui;padding:30px;text-align:center"><h1>SüffIQ</h1><p>Offline-Shell wird vorbereitet. Sobald kurz Internet da ist, steht die Startseite danach auch offline bereit.</p></body></html>',{status:200,headers:{'content-type':'text/html; charset=utf-8'}});
    }
  })());
});`;

module.exports = function pwaHandler(req, res) {
  const url = String(req.url || '').split('?')[0];
  if (url === '/manifest.webmanifest') {
    res.writeHead(200, { 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'public, max-age=3600', 'x-content-type-options': 'nosniff' });
    res.end(manifest); return true;
  }
  if (url === '/sw.js') {
    res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-cache', 'service-worker-allowed': '/', 'x-content-type-options': 'nosniff' });
    res.end(sw); return true;
  }
  if (url === '/icon.svg') {
    res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' });
    res.end(icon); return true;
  }
  return false;
};
