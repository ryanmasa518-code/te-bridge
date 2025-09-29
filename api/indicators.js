const { teFetch, sendJson } = require("./_te");
module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const q = Object.fromEntries(url.searchParams.entries());
    const data = await teFetch("/indicators", q);
    sendJson(res, 200, data);
  } catch (e) {
    sendJson(res, e.status || 500, e.body || { error: e.message });
  }
};
