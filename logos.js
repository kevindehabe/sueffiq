'use strict';

// Nur Bildmarken/Symbole – keine ausgeschriebenen Wortmarken. Die SVGs kommen
// überwiegend aus dem Simple-Icons-CDN und werden auf einer neutralen Karte gezeigt.
// Für Marken ohne geeignetes CDN-Symbol nutzen wir bewusst reduzierte, lokale
// Erkennungszeichen ohne ausgeschriebenen Namen.
const CUSTOM_LOGO_SVGS = Object.freeze({
  pornhub: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect width="240" height="160" rx="28" fill="#111"/><path fill="#fff" d="M34 42h35c24 0 39 12 39 32s-15 33-39 33H57v20H34zm23 20v25h11c10 0 16-4 16-13 0-8-6-12-16-12z"/><rect x="116" y="37" width="91" height="90" rx="14" fill="#ff9000"/><path fill="#111" d="M137 54h21v22h20V54h21v56h-21V88h-20v22h-21z"/></svg>',
  xhamster: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect width="240" height="160" rx="28" fill="#fff3e7"/><circle cx="78" cy="53" r="25" fill="#f47b20"/><circle cx="162" cy="53" r="25" fill="#f47b20"/><circle cx="78" cy="53" r="12" fill="#ffd6b7"/><circle cx="162" cy="53" r="12" fill="#ffd6b7"/><path fill="#f47b20" d="M54 76c7-31 28-47 66-47s59 16 66 47v32c0 23-26 39-66 39s-66-16-66-39z"/><path stroke="#1c1c1c" stroke-width="8" stroke-linecap="round" d="m83 75 14 14m0-14-14 14m60-14 14 14m0-14-14 14"/><ellipse cx="120" cy="105" rx="25" ry="18" fill="#fff"/><path fill="#1c1c1c" d="M109 99h22l-11 11z"/><path stroke="#1c1c1c" stroke-width="5" stroke-linecap="round" d="M120 110v10m0 0-11 7m11-7 11 7"/></svg>',
  brazzers: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect width="240" height="160" rx="28" fill="#090909"/><path fill="#fff" d="M45 31h69c33 0 50 12 50 34 0 13-7 22-21 28 18 5 27 16 27 32 0 25-20 36-56 36H45zm36 28v21h27c12 0 18-4 18-11s-6-10-18-10zm0 47v25h31c14 0 21-4 21-12 0-9-7-13-21-13z" transform="translate(0 -16)"/><path fill="#e31b23" d="m174 29 25 0-20 37h25l-52 67 16-46h-25z"/></svg>',
  redtube: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect width="240" height="160" rx="28" fill="#111"/><rect x="32" y="42" width="176" height="76" rx="38" fill="#e51b23"/><circle cx="120" cy="80" r="28" fill="#fff"/><path fill="#e51b23" d="m112 63 24 17-24 17z"/></svg>',
  xvideos: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect width="240" height="160" rx="28" fill="#090909"/><path fill="#e21b2d" d="m38 35 35 0 47 60 47-60h35l-64 80h-36z"/><circle cx="120" cy="80" r="25" fill="#fff"/><path fill="#111" d="m113 64 23 16-23 16z"/></svg>',
  xnxx: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect width="240" height="160" rx="28" fill="#111"/><path fill="#ef233c" d="M35 37h30l55 86H90zm140 0h30l-55 86h-30z"/><path fill="#fff" d="M83 37h25l49 86h-25zm49 0h25l-49 86H83z"/></svg>',
  youporn: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect width="240" height="160" rx="28" fill="#fff"/><circle cx="86" cy="80" r="50" fill="#ef397b"/><circle cx="154" cy="80" r="50" fill="#ff9e1b"/><path fill="#fff" d="M53 52h22l11 20 11-20h22L97 89v24H75V89zm82 0h28c25 0 38 11 38 30s-13 31-38 31h-28zm21 19v23h7c11 0 17-4 17-12 0-7-6-11-17-11z"/></svg>',
  playboy: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect width="240" height="160" rx="28" fill="#fff"/><path fill="#111" d="M88 18c19 4 34 17 41 35 14-18 30-29 49-32-1 25-11 45-29 58 11 9 18 22 18 37 0 25-20 44-47 44-31 0-53-21-53-49 0-25 15-44 39-50-10-17-16-31-18-43z"/><circle cx="135" cy="91" r="6" fill="#fff"/><path fill="#111" d="m78 112-28-15v30zm84 0 28-15v30z"/></svg>',
  chaturbate: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect width="240" height="160" rx="28" fill="#fff7ed"/><path fill="#f58b23" d="M35 35h170v88H137l-26 23v-23H35z"/><rect x="69" y="59" width="70" height="43" rx="10" fill="#fff"/><path fill="#fff" d="m143 68 30-17v59l-30-17z"/><circle cx="103" cy="80" r="12" fill="#f58b23"/></svg>',
  mercedes: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect width="240" height="160" rx="28" fill="#f5f7f8"/><circle cx="120" cy="80" r="57" fill="none" stroke="#1b1f22" stroke-width="8"/><path fill="#1b1f22" d="m120 25 8 45 41 31-46-13-3 47-3-47-46 13 41-31z"/></svg>',
  amazon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect width="240" height="160" rx="28" fill="#fff"/><path fill="#20242a" d="M78 40h48c28 0 43 13 43 38v34h-25l-3-11c-10 10-22 15-37 15-23 0-38-13-38-33 0-22 18-35 50-35h20c-2-10-9-14-23-14-11 0-22 3-35 9zm58 27h-17c-15 0-23 5-23 14 0 8 6 12 16 12 14 0 24-8 24-21z"/><path fill="none" stroke="#ff9900" stroke-width="9" stroke-linecap="round" d="M55 125c35 22 85 24 124 4"/><path fill="#ff9900" d="m173 117 25 9-18 19z"/></svg>',
  xbox: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect width="240" height="160" rx="28" fill="#fff"/><circle cx="120" cy="80" r="59" fill="#107c10"/><path fill="#fff" d="M78 44c11-12 25-18 42-18 17 0 31 6 42 18-14-7-28-3-42 10-14-13-28-17-42-10zm-16 69c4-22 18-42 44-60l14 16 14-16c26 18 40 38 44 60-13 16-32 26-58 26s-45-10-58-26z"/></svg>',
  pepsi: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect width="240" height="160" rx="28" fill="#fff"/><defs><clipPath id="p"><circle cx="120" cy="80" r="61"/></clipPath></defs><g clip-path="url(#p)"><rect x="59" y="19" width="122" height="61" fill="#e32934"/><rect x="59" y="80" width="122" height="61" fill="#164b9b"/><path fill="#fff" d="M54 68c34 13 68 13 132-9v38c-53-15-87-10-132 10z"/></g><circle cx="120" cy="80" r="61" fill="none" stroke="#e7e7e7" stroke-width="3"/></svg>',
  slack: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect width="240" height="160" rx="28" fill="#fff"/><rect x="52" y="67" width="59" height="25" rx="12.5" fill="#36c5f0"/><circle cx="65" cy="51" r="13" fill="#36c5f0"/><rect x="129" y="49" width="25" height="59" rx="12.5" fill="#2eb67d"/><circle cx="170" cy="62" r="13" fill="#2eb67d"/><rect x="129" y="68" width="59" height="25" rx="12.5" fill="#ecb22e"/><circle cx="175" cy="109" r="13" fill="#ecb22e"/><rect x="86" y="49" width="25" height="59" rx="12.5" fill="#e01e5a"/><circle cx="70" cy="98" r="13" fill="#e01e5a"/></svg>',
  openai: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160"><rect width="240" height="160" rx="28" fill="#fff"/><g fill="none" stroke="#101010" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><path d="M120 31c23-14 51 3 50 29 23 12 22 44 0 57-1 26-29 43-51 29-23 14-51-3-50-29-23-12-22-44 0-57 1-26 29-43 51-29z"/><path d="m91 47 58 34-1 34-29 17-58-34 1-34zm58 34-29 17-29-17m29 17v34"/></g></svg>'
});

const LOGO_PROMPTS = [
  { id: 'lg01', name: 'Apple', slug: 'apple', aliases: ['iphone', 'mac'] },
  { id: 'lg02', name: 'Nike', slug: 'nike', aliases: ['swoosh'] },
  { id: 'lg03', name: 'Adidas', slug: 'adidas', aliases: [] },
  { id: 'lg04', name: "McDonald's", slug: 'mcdonalds', aliases: ['mcdonalds', 'mc donalds', 'mcces', 'mäcces', 'mecces'] },
  { id: 'lg05', name: 'Mercedes-Benz', slug: 'mercedes', asset: 'mercedes', aliases: ['mercedes', 'benz', 'mercedes benz'] },
  { id: 'lg06', name: 'BMW', slug: 'bmw', aliases: ['bayerische motoren werke'] },
  { id: 'lg07', name: 'Audi', slug: 'audi', aliases: ['vier ringe'] },
  { id: 'lg08', name: 'Volkswagen', slug: 'volkswagen', aliases: ['vw'] },
  { id: 'lg09', name: 'Ferrari', slug: 'ferrari', aliases: [] },
  { id: 'lg10', name: 'Lamborghini', slug: 'lamborghini', aliases: ['lambo'] },
  { id: 'lg11', name: 'Tesla', slug: 'tesla', aliases: [] },
  { id: 'lg12', name: 'Spotify', slug: 'spotify', aliases: [] },
  { id: 'lg13', name: 'YouTube', slug: 'youtube', aliases: ['youtube'] },
  { id: 'lg14', name: 'Instagram', slug: 'instagram', aliases: ['insta'] },
  { id: 'lg15', name: 'TikTok', slug: 'tiktok', aliases: ['tik tok'] },
  { id: 'lg16', name: 'Snapchat', slug: 'snapchat', aliases: ['snap'] },
  { id: 'lg17', name: 'WhatsApp', slug: 'whatsapp', aliases: ['whats app'] },
  { id: 'lg18', name: 'Telegram', slug: 'telegram', aliases: [] },
  { id: 'lg19', name: 'Reddit', slug: 'reddit', aliases: [] },
  { id: 'lg20', name: 'Discord', slug: 'discord', aliases: [] },
  { id: 'lg21', name: 'Twitch', slug: 'twitch', aliases: [] },
  { id: 'lg22', name: 'X', slug: 'x', aliases: ['twitter', 'x twitter'] },
  { id: 'lg23', name: 'Facebook', slug: 'facebook', aliases: ['fb'] },
  { id: 'lg24', name: 'Amazon', slug: 'amazon', asset: 'amazon', aliases: [] },
  { id: 'lg25', name: 'PlayStation', slug: 'playstation', aliases: ['play station', 'ps', 'ps5', 'ps4'] },
  { id: 'lg26', name: 'Xbox', slug: 'xbox', asset: 'xbox', aliases: [] },
  { id: 'lg27', name: 'Steam', slug: 'steam', aliases: [] },
  { id: 'lg28', name: 'GitHub', slug: 'github', aliases: ['git hub'] },
  { id: 'lg29', name: 'Android', slug: 'android', aliases: [] },
  { id: 'lg30', name: 'Google Chrome', slug: 'googlechrome', aliases: ['chrome', 'google chrome'] },
  { id: 'lg31', name: 'Firefox', slug: 'firefoxbrowser', aliases: ['mozilla firefox', 'fire fox'] },
  { id: 'lg32', name: 'Airbnb', slug: 'airbnb', aliases: ['air bnb'] },
  { id: 'lg33', name: 'Dropbox', slug: 'dropbox', aliases: ['drop box'] },
  { id: 'lg34', name: 'Mastercard', slug: 'mastercard', aliases: ['master card'] },
  { id: 'lg35', name: 'Shell', slug: 'shell', aliases: [] },
  { id: 'lg36', name: 'Pepsi', slug: 'pepsi', asset: 'pepsi', aliases: [] },
  { id: 'lg37', name: 'Starbucks', slug: 'starbucks', aliases: ['star bucks'] },
  { id: 'lg38', name: 'PayPal', slug: 'paypal', aliases: ['pay pal'] },
  { id: 'lg39', name: 'Pinterest', slug: 'pinterest', aliases: [] },
  { id: 'lg40', name: 'Puma', slug: 'puma', aliases: [] },
  { id: 'lg41', name: 'Under Armour', slug: 'underarmour', aliases: ['under armour'] },
  { id: 'lg42', name: 'New Balance', slug: 'newbalance', aliases: ['new balance', 'nb'] },
  { id: 'lg43', name: 'NVIDIA', slug: 'nvidia', aliases: ['nvidia'] },
  { id: 'lg44', name: 'AMD', slug: 'amd', aliases: [] },
  { id: 'lg45', name: 'Tinder', slug: 'tinder', aliases: [] },
  { id: 'lg46', name: 'Shazam', slug: 'shazam', aliases: [] },
  { id: 'lg47', name: 'Slack', slug: 'slack', asset: 'slack', aliases: [] },
  { id: 'lg48', name: 'Figma', slug: 'figma', aliases: [] },
  { id: 'lg49', name: 'OpenAI', slug: 'openai', asset: 'openai', aliases: ['chatgpt', 'chat gpt'] },
  { id: 'lg50', name: 'Google Maps', slug: 'googlemaps', aliases: ['maps', 'google maps'] },
  { id: 'lg51', name: 'Google', slug: 'google', aliases: [] },
  { id: 'lg52', name: 'Messenger', slug: 'messenger', aliases: ['facebook messenger'] },
  { id: 'lg53', name: 'Threads', slug: 'threads', aliases: ['instagram threads'] },
  { id: 'lg54', name: 'Signal', slug: 'signal', aliases: ['signal messenger'] },
  { id: 'lg55', name: 'Apple Music', slug: 'applemusic', aliases: ['apple musik'] },
  { id: 'lg56', name: 'SoundCloud', slug: 'soundcloud', aliases: ['sound cloud'] },
  { id: 'lg57', name: 'Deezer', slug: 'deezer', aliases: [] },
  { id: 'lg58', name: 'Netflix', slug: 'netflix', aliases: [] },
  { id: 'lg59', name: 'OnlyFans', slug: 'onlyfans', aliases: ['only fans'] },
  { id: 'lg60', name: 'Google Play', slug: 'googleplay', aliases: ['play store', 'google play store'] },
  { id: 'lg61', name: 'Cloudflare', slug: 'cloudflare', aliases: ['cloud flare'] },
  { id: 'lg62', name: 'Bitcoin', slug: 'bitcoin', aliases: ['btc'] },
  { id: 'lg63', name: 'Binance', slug: 'binance', aliases: [] },
  { id: 'lg64', name: 'Coinbase', slug: 'coinbase', aliases: ['coin base'] },
  { id: 'lg65', name: 'Commerzbank', slug: 'commerzbank', aliases: [] },
  { id: 'lg66', name: 'Sparkasse', slug: 'sparkasse', aliases: [] },
  { id: 'lg67', name: 'Deutsche Telekom', slug: 'deutschetelekom', aliases: ['telekom', 't mobile', 't-mobile'] },
  { id: 'lg68', name: 'Deutsche Bahn', slug: 'deutschebahn', aliases: ['db', 'bahn'] },
  { id: 'lg69', name: 'EDEKA', slug: 'edeka', aliases: [] },
  { id: 'lg70', name: 'MediaMarkt', slug: 'mediamarkt', aliases: ['media markt'] },
  { id: 'lg71', name: 'Carrefour', slug: 'carrefour', aliases: [] },
  { id: 'lg72', name: 'Red Bull', slug: 'redbull', aliases: ['redbull'] },
  { id: 'lg73', name: 'KFC', slug: 'kfc', aliases: ['kentucky fried chicken'] },
  { id: 'lg74', name: 'Porsche', slug: 'porsche', aliases: [] },
  { id: 'lg75', name: 'Toyota', slug: 'toyota', aliases: [] },
  { id: 'lg76', name: 'Hyundai', slug: 'hyundai', aliases: [] },
  { id: 'lg77', name: 'Opel', slug: 'opel', aliases: [] },
  { id: 'lg78', name: 'ŠKODA', slug: 'skoda', aliases: ['skoda'] },
  { id: 'lg79', name: 'SEAT', slug: 'seat', aliases: [] },
  { id: 'lg80', name: 'Honda', slug: 'honda', aliases: [] },
  { id: 'lg81', name: 'Renault', slug: 'renault', aliases: [] },
  { id: 'lg82', name: 'Peugeot', slug: 'peugeot', aliases: [] },
  { id: 'lg83', name: 'Citroën', slug: 'citroen', aliases: ['citroen'] },
  { id: 'lg84', name: 'Mazda', slug: 'mazda', aliases: [] },
  { id: 'lg85', name: 'Mitsubishi', slug: 'mitsubishi', aliases: [] },
  { id: 'lg86', name: 'Subaru', slug: 'subaru', aliases: [] },
  { id: 'lg87', name: 'Volvo', slug: 'volvo', aliases: [] },
  { id: 'lg88', name: 'Polestar', slug: 'polestar', aliases: ['pole star'] },
  { id: 'lg89', name: 'Dacia', slug: 'dacia', aliases: [] },
  { id: 'lg90', name: 'Maserati', slug: 'maserati', aliases: [] },
  { id: 'lg91', name: 'Counter-Strike', slug: 'counterstrike', aliases: ['counter strike', 'cs', 'cs2', 'counter strike 2'] },
  { id: 'lg92', name: 'League of Legends', slug: 'leagueoflegends', aliases: ['league', 'lol'] },
  { id: 'lg93', name: 'Valorant', slug: 'valorant', aliases: ['valo'] },
  { id: 'lg94', name: 'Roblox', slug: 'roblox', aliases: [] },
  { id: 'lg95', name: 'Riot Games', slug: 'riotgames', aliases: ['riot'] },
  { id: 'lg96', name: 'Rockstar Games', slug: 'rockstargames', aliases: ['rockstar', 'rockstar games'] },
  { id: 'lg97', name: 'Battle.net', slug: 'battledotnet', aliases: ['battlenet', 'battle net'] },
  { id: 'lg98', name: 'Ubisoft', slug: 'ubisoft', aliases: [] },
  { id: 'lg99', name: 'EA', slug: 'ea', aliases: ['electronic arts'] },
  { id: 'lg100', name: 'Reebok', slug: 'reebok', aliases: [] },
  { id: 'lg101', name: 'NBA', slug: 'nba', aliases: ['national basketball association'] },
  { id: 'lg102', name: 'Strava', slug: 'strava', aliases: [] },
  { id: 'lg103', name: 'Speedtest', slug: 'speedtest', aliases: ['ookla', 'speed test'] },
  { id: 'lg104', name: 'Kick', slug: 'kick', aliases: ['kick streaming'] },
  { id: 'lg105', name: 'Wikipedia', slug: 'wikipedia', aliases: ['wiki'] },
  { id: 'lg106', name: 'Zalando', slug: 'zalando', aliases: [] },
  { id: 'lg107', name: 'Crunchyroll', slug: 'crunchyroll', aliases: ['crunchy roll'] },
  { id: 'lg108', name: 'Evernote', slug: 'evernote', aliases: ['ever note'] },
  { id: 'lg109', name: 'Revolut', slug: 'revolut', aliases: [] },
  { id: 'lg110', name: 'Apple TV', slug: 'appletv', aliases: ['apple tv plus', 'apple tv+'] },
  { id: 'lg111', name: 'TIDAL', slug: 'tidal', aliases: [] },
  { id: 'lg112', name: 'YouTube Music', slug: 'youtubemusic', aliases: ['youtube musik'] },
  { id: 'lg113', name: 'ZDF', slug: 'zdf', aliases: ['zweites deutsches fernsehen'] },
  { id: 'lg114', name: 'Paramount+', slug: 'paramountplus', aliases: ['paramount plus', 'paramount'] },
  { id: 'lg115', name: 'Bandcamp', slug: 'bandcamp', aliases: ['band camp'] },
  { id: 'lg116', name: 'DAZN', slug: 'dazn', aliases: [] },
  { id: 'lg117', name: 'Pornhub', slug: 'pornhub', asset: 'pornhub', aliases: ['porn hub', 'ph'] },
  { id: 'lg118', name: 'xHamster', slug: 'xhamster', asset: 'xhamster', aliases: ['x hamster'] },
  { id: 'lg119', name: 'Brazzers', slug: 'brazzers', asset: 'brazzers', aliases: ['brazzer', 'brazer', 'brazers'] },
  { id: 'lg120', name: 'RedTube', slug: 'redtube', asset: 'redtube', aliases: ['red tube'] },
  { id: 'lg121', name: 'XVideos', slug: 'xvideos', asset: 'xvideos', aliases: ['x videos'] },
  { id: 'lg122', name: 'XNXX', slug: 'xnxx', asset: 'xnxx', aliases: ['xn xx'] },
  { id: 'lg123', name: 'YouPorn', slug: 'youporn', asset: 'youporn', aliases: ['you porn'] },
  { id: 'lg124', name: 'Playboy', slug: 'playboy', asset: 'playboy', aliases: ['play boy'] },
  { id: 'lg125', name: 'Chaturbate', slug: 'chaturbate', asset: 'chaturbate', aliases: ['chatterbate', 'chatur bate'] },
];

function shuffle(xs) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickLogoPrompt(room) {
  if (!room.logoQueue || !Array.isArray(room.logoQueue) || room.logoQueue.length === 0) {
    const previous = room.lastLogoId || null;
    room.logoQueue = shuffle(LOGO_PROMPTS.map((item) => item.id));
    if (room.logoQueue.length > 1 && room.logoQueue[0] === previous) [room.logoQueue[0], room.logoQueue[1]] = [room.logoQueue[1], room.logoQueue[0]];
  }
  const id = room.logoQueue.shift();
  const item = LOGO_PROMPTS.find((x) => x.id === id) || LOGO_PROMPTS[0];
  room.lastLogoId = item.id;
  return item;
}

function normalizeLogoText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

function editDistance(a, b) {
  const x = normalizeLogoText(a); const y = normalizeLogoText(b);
  if (!x) return y.length; if (!y) return x.length;
  const row = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i += 1) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= y.length; j += 1) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (x[i - 1] === y[j - 1] ? 0 : 1));
      prev = old;
    }
  }
  return row[y.length];
}

function matchLogoGuess(item, guess) {
  const g = normalizeLogoText(guess);
  if (!item || g.length < 1) return { status: 'wrong' };
  const candidates = [item.name, ...(item.aliases || [])].map(normalizeLogoText).filter(Boolean);
  if (candidates.includes(g)) return { status: 'correct' };
  for (const target of candidates) {
    if (g.length >= 4 && target.length >= 4 && (target.startsWith(g) || g.startsWith(target))) return { status: 'near' };
    const max = Math.max(g.length, target.length);
    if (max >= 5 && editDistance(g, target) <= (max >= 9 ? 2 : 1)) return { status: 'near' };
  }
  return { status: 'wrong' };
}

function logoImageUrl(item) {
  if (!item || !item.slug) return null;
  if (item.asset && CUSTOM_LOGO_SVGS[item.asset]) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(CUSTOM_LOGO_SVGS[item.asset])}`;
  }
  return `https://cdn.simpleicons.org/${encodeURIComponent(item.slug)}`;
}

module.exports = { LOGO_PROMPTS, pickLogoPrompt, matchLogoGuess, logoImageUrl, normalizeLogoText };
