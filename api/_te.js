// 共有: レート制御・キャッシュ・フェッチ
const TE_BASE = "https://api.tradingeconomics.com";
const TE_API_KEY = process.env.TE_API_KEY || "guest:guest";
const TE_RATE_MS = Number(process.env.TE_RATE_MS || 2000);        // 無料は2秒推奨
const TE_CACHE_TTL_SEC = Number(process.env.TE_CACHE_TTL_SEC || 900); // デフォ15分

const teCache = new Map(); // url -> { at(ms), data }
let teLastTs = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rateGate() {
  const now = Date.now();
  const wait = teLastTs + TE_RATE_MS - now;
  if (wait > 0) await sleep(wait);
  teLastTs = Date.now();
}
function fromCache(url) {
  const e = teCache.get(url);
  if (!e) return null;
  if ((Date.now() - e.at) / 1000 > TE_CACHE_TTL_SEC) {
    teCache.delete(url);
    return null;
  }
  return e.data;
}
function saveCache(url, data) {
  teCache.set(url, { at: Date.now(), data });
}
async function teFetch(path, query) {
  const url = new URL(TE_BASE + path);
  url.searchParams.set("c", TE_API_KEY);
  url.searchParams.set("f", "json");
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const urlStr = url.toString();

  const cached = fromCache(urlStr);
  if (cached) return cached;

  await rateGate();

  let attempt = 0;
  while (true) {
    attempt++;
    const resp = await fetch(urlStr);
    const text = await resp.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }

    if (resp.ok) {
      saveCache(urlStr, json);
      return json;
    }
    if ((resp.status === 409 || resp.status === 429 || resp.status >= 500) && attempt < 5) {
      const backoff = Math.min(2000 * (2 ** (attempt - 1)), 15000);
      const jitter = Math.floor(Math.random() * 250);
      await sleep(backoff + jitter);
      continue;
    }
    const err = new Error(`TE ${resp.status}`);
    err.status = resp.status;
    err.body = json;
    throw err;
  }
}
function sendJson(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

module.exports = { teFetch, sendJson };
