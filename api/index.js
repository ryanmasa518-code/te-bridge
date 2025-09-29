// api/index.js
module.exports = (req, res) => {
  if (req.url === "/health") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = 200;
    res.end(JSON.stringify({ status: "ok", time: new Date().toISOString() }));
    return;
  }

  // 他は一旦 404
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "not found" }));
};
