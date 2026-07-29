// Local dev server — mimics Vercel: serves index.html and runs api/stats.js.
// Loads LEMLIST_API_KEY from .env.local. Run with: npm run dev
// This file is for local testing only; Vercel ignores it (only api/ runs there).

const http = require("http");
const fs = require("fs");
const path = require("path");

// Minimal .env.local loader (no dependency needed).
const envPath = path.join(__dirname, ".env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach(function (line) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  });
}

const statsHandler = require("./api/stats.js");

const server = http.createServer(async function (req, res) {
  const url = req.url.split("?")[0];

  if (url === "/api/stats") {
    // Shim the Express/Vercel-style helpers the handler expects.
    res.status = function (code) { res.statusCode = code; return res; };
    res.json = function (obj) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(obj));
      return res;
    };
    try {
      await statsHandler(req, res);
    } catch (e) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: String(e.message || e) }));
    }
    return;
  }

  if (url === "/" || url === "/index.html") {
    res.setHeader("Content-Type", "text/html");
    res.end(fs.readFileSync(path.join(__dirname, "index.html")));
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, function () {
  console.log("Dashboard local : http://localhost:" + PORT);
  if (!process.env.LEMLIST_API_KEY) {
    console.log("⚠️  LEMLIST_API_KEY introuvable — vérifie ton fichier .env.local");
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("⚠️  ANTHROPIC_API_KEY introuvable — sentiment non classé (fallback CURATED)");
  }
});
