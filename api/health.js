const { sendJson } = require("./_te");
module.exports = (_req, res) => {
  sendJson(res, 200, { status: "ok", time: new Date().toISOString() });
};
