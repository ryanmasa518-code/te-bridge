// api/index.js  (Vercel: Node.js 18+)
import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));

// ===== Config (env) =====
const TE_BASE = "https://api.tradingeconomics.com";
const TE_API_KEY = process.env.TE_API_KEY || "guest:guest";
const TE_RATE_MS = Number(process.env.TE_RATE_MS || 1200);         // 最低間隔(ミリ秒)
const TE_CACHE_TTL_SEC = Number(process.env.TE_CACHE_TTL_SEC || 900); // キャッシュTTL(秒)

const teCache = new Map(); // key: url, val: { at:number(ms), data:any }
let teLastTs = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rateGate() {
  const now = Date.now();
  const wait = teLastTs + TE_RATE_MS - now;
  if (wait > 0) await sleep(wait);
  teLastTs = Date.now();
}

function fromCache(urlStr) {
  const ent = teCache.get(urlStr);
  if (!ent) return null;
  if ((Date.now() - ent.at) / 1000 > TE_CACHE_TTL_SEC) {
    teCache.delete(urlStr);
    return null;
  }
  return ent.data;
}

function saveCache(urlStr, data) {
  teCache.set(urlStr, { at: Date.now(), data });
}

async function teFetch(path, query = {}) {
  const url = new URL(TE_BASE + path);
  url.searchParams.set("c", TE_API_KEY);
  url.searchParams.set("f", "json");
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const urlStr = url.toString();

  const cached = fromCache(urlStr);
  if (cached) return cached;

  await rateGate();

  let attempt = 0;
  while (true) {
    attempt++;
    const res = await fetch(urlStr);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }

    if (res.ok) {
      saveCache(urlStr, json);
      return json;
    }

    // 409/429/5xx はバックオフ再試行
    if ((res.status === 409 || res.status === 429 || res.status >= 500) && attempt < 5) {
      const backoff = Math.min(2000 * 2 ** (attempt - 1), 15000);
      const jitter = Math.floor(Math.random() * 250);
      await sleep(backoff + jitter);
      continue;
    }

    const err = new Error(`TE ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
}

// ---- Routes ----
// Health
app.get("/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

// Historical (no range): /historical?country=united states&indicator=gdp
app.get("/historical", async (req, res) => {
  try {
    const { country, indicator } = req.query;
    if (!country || !indicator) return res.status(400).json({ error: "country & indicator required" });
    const path = `/historical/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicator)}`;
    res.json(await teFetch(path));
  } catch (e) {
    res.status(e.status || 500).json(e.body || { error: e.message });
  }
});

// Historical (with range): /historical/range?country=...&indicator=...&start=YYYY-MM-DD&end=YYYY-MM-DD
app.get("/historical/range", async (req, res) => {
  try {
    const { country, indicator, start, end } = req.query;
    if (!country || !indicator || !start || !end)
      return res.status(400).json({ error: "country, indicator, start, end required (YYYY-MM-DD)" });
    const path = `/historical/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicator)}/${start}/${end}`;
    res.json(await teFetch(path));
  } catch (e) {
    res.status(e.status || 500).json(e.body || { error: e.message });
  }
});

// Indicators snapshot: /indicators?country=...&indicator=...
app.get("/indicators", async (req, res) => {
  try { res.json(await teFetch("/indicators", req.query)); }
  catch (e) { res.status(e.status || 500).json(e.body || { error: e.message }); }
});

// Calendar: /calendar?country=...&start=YYYY-MM-DD&end=YYYY-MM-DD
app.get("/calendar", async (req, res) => {
  try { res.json(await teFetch("/calendar", req.query)); }
  catch (e) { res.status(e.status || 500).json(e.body || { error: e.message }); }
});

// Vercel export
export default (req, res) => app(req, res);
