const { teFetch, sendJson } = require("./_te");
module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const q = Object.fromEntries(url.searchParams.entries());
    const { country, indicator } = q;
    if (!country || !indicator) return sendJson(res, 400, { error: "country & indicator required" });
    const path = `/historical/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicator)}`;
    const data = await teFetch(path, null);
    sendJson(res, 200, data);
  } catch (e) {
    sendJson(res, e.status || 500, e.body || { error: e.message });
  }
};
