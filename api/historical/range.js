const { teFetch, sendJson } = require("../_te");
module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const q = Object.fromEntries(url.searchParams.entries());
    const { country, indicator, start, end } = q;
    if (!country || !indicator || !start || !end) {
      return sendJson(res, 400, { error: "country, indicator, start, end required (YYYY-MM-DD)" });
    }
    const path = `/historical/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicator)}/${start}/${end}`;
    const data = await teFetch(path, null);
    sendJson(res, 200, data);
  } catch (e) {
    sendJson(res, e.status || 500, e.body || { error: e.message });
  }
};
