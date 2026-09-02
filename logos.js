'use strict';

// Nur Bildmarken/Symbole – keine ausgeschriebenen Wortmarken. Die SVGs kommen
// aus dem Simple-Icons-CDN und werden im Spiel auf einer neutralen Karte gezeigt.
const LOGO_PROMPTS = [
  { id: 'lg01', name: 'Apple', slug: 'apple', aliases: ['iphone', 'mac'] },
  { id: 'lg02', name: 'Nike', slug: 'nike', aliases: ['swoosh'] },
  { id: 'lg03', name: 'Adidas', slug: 'adidas', aliases: [] },
  { id: 'lg04', name: "McDonald's", slug: 'mcdonalds', aliases: ['mcdonalds', 'mc donalds', 'mcces', 'mäcces', 'mecces'] },
  { id: 'lg05', name: 'Mercedes-Benz', slug: 'mercedes', aliases: ['mercedes', 'benz', 'mercedes benz'] },
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
  { id: 'lg24', name: 'Amazon', slug: 'amazon', aliases: [] },
  { id: 'lg25', name: 'PlayStation', slug: 'playstation', aliases: ['play station', 'ps', 'ps5', 'ps4'] },
  { id: 'lg26', name: 'Xbox', slug: 'xbox', aliases: [] },
  { id: 'lg27', name: 'Steam', slug: 'steam', aliases: [] },
  { id: 'lg28', name: 'GitHub', slug: 'github', aliases: ['git hub'] },
  { id: 'lg29', name: 'Android', slug: 'android', aliases: [] },
  { id: 'lg30', name: 'Google Chrome', slug: 'googlechrome', aliases: ['chrome', 'google chrome'] },
  { id: 'lg31', name: 'Firefox', slug: 'firefoxbrowser', aliases: ['mozilla firefox', 'fire fox'] },
  { id: 'lg32', name: 'Airbnb', slug: 'airbnb', aliases: ['air bnb'] },
  { id: 'lg33', name: 'Dropbox', slug: 'dropbox', aliases: ['drop box'] },
  { id: 'lg34', name: 'Mastercard', slug: 'mastercard', aliases: ['master card'] },
  { id: 'lg35', name: 'Shell', slug: 'shell', aliases: [] },
  { id: 'lg36', name: 'Pepsi', slug: 'pepsi', aliases: [] },
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
  { id: 'lg47', name: 'Slack', slug: 'slack', aliases: [] },
  { id: 'lg48', name: 'Figma', slug: 'figma', aliases: [] },
  { id: 'lg49', name: 'OpenAI', slug: 'openai', aliases: ['chatgpt', 'chat gpt'] },
  { id: 'lg50', name: 'Google Maps', slug: 'googlemaps', aliases: ['maps', 'google maps'] },
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
  return `https://cdn.simpleicons.org/${encodeURIComponent(item.slug)}`;
}

module.exports = { LOGO_PROMPTS, pickLogoPrompt, matchLogoGuess, logoImageUrl, normalizeLogoText };
