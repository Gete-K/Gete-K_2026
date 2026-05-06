/**
 * ローカル確認用の小さな静的サーバーです。
 *
 * 使い方：
 *   node tools/local-server.cjs 8000
 *
 * なぜ必要？
 * - index.html を直接ダブルクリックで開くと、ブラウザの安全制限で
 *   content/site.def を読み込めないことがあります。
 * - http://127.0.0.1:8000/ のようにサーバー経由で開くと、
 *   公開時に近い状態で確認できます。
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.argv[2] || 8000);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".def": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const requested = decodeURIComponent(url.pathname);

  // URLが "/" のときは index.html を返す。
  let file = path.resolve(root, `.${requested}`);
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, "index.html");
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local server: http://127.0.0.1:${port}/`);
});
