const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const root = path.resolve(__dirname, "../..");
const toolDir = path.join(root, "tools", "site-editor");
const siteDefPath = path.join(root, "content", "site.def");
const imagesDir = path.join(root, "images");
const backupImagesDir = path.join(root, "backup", "images");
const port = Number(process.argv[2] || process.env.PORT || 8123);

const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
const allowedBranch = /^[A-Za-z0-9/_-]+$/;
const allowedFileName = /^[A-Za-z0-9._-]+$/;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".cjs": "text/plain; charset=utf-8",
  ".def": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function send(res, status, body, headers = {}) {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "Content-Type": Buffer.isBuffer(data) ? "application/octet-stream" : "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 12 * 1024 * 1024) {
        reject(new Error("request too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const body = await readBody(req);
  if (!body.length) return {};
  return JSON.parse(body.toString("utf8"));
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function ensureInside(base, target) {
  const resolvedBase = path.resolve(base);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error("path is outside allowed directory");
  }
  return resolvedTarget;
}

function runGit(args) {
  return new Promise((resolve) => {
    execFile("git", args, { cwd: root, windowsHide: true }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error?.code || 0,
        stdout,
        stderr: stderr.trim(),
      });
    });
  });
}

async function currentBranch() {
  const out = await runGit(["branch", "--show-current"]);
  return out.stdout.trim() || "(detached)";
}

async function gitStatus() {
  const short = await runGit(["status", "--short"]);
  const branch = await currentBranch();
  const porcelain = short.stdout.split(/\r?\n/).filter(Boolean);
  return { branch, isMain: branch === "main", short: short.stdout, porcelain };
}

function parseDef(text) {
  const warnings = [];
  const seen = new Map();
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const rawLines = text.split(/\r\n|\n/);
  const hasTrailingNewline = /(\r\n|\n)$/.test(text);
  if (hasTrailingNewline) rawLines.pop();

  const lines = rawLines.map((raw, index) => {
    if (/^\s*$/.test(raw)) return { type: "blank", raw, index };
    if (/^\s*;/.test(raw)) return { type: "comment", raw, index };
    const eq = raw.indexOf("=");
    if (eq < 0) {
      warnings.push({ type: "invalid", line: index + 1, message: "= がない不正行です。" });
      return { type: "invalid", raw, index };
    }
    const keyPart = raw.slice(0, eq);
    const valuePart = raw.slice(eq + 1);
    const key = keyPart.trim();
    if (!key) {
      warnings.push({ type: "invalid", line: index + 1, message: "key が空です。" });
      return { type: "invalid", raw, index };
    }
    if (seen.has(key)) {
      warnings.push({ type: "duplicate", line: index + 1, key, message: `重複 key: ${key}` });
    }
    seen.set(key, (seen.get(key) || 0) + 1);
    const leadingValueSpace = valuePart.match(/^\s*/)[0];
    return {
      type: "entry",
      raw,
      index,
      key,
      value: valuePart.slice(leadingValueSpace.length),
      prefix: keyPart + "=" + leadingValueSpace,
    };
  });

  return { lines, warnings, newline, hasTrailingNewline };
}

function buildDef(parsed, valuesByIndex) {
  const missing = [];
  const out = parsed.lines.map((line) => {
    if (line.type !== "entry") return line.raw;
    if (!Object.prototype.hasOwnProperty.call(valuesByIndex, String(line.index))) {
      missing.push(line.key);
      return line.raw;
    }
    return line.prefix + String(valuesByIndex[String(line.index)] ?? "");
  });
  return {
    text: out.join(parsed.newline) + (parsed.hasTrailingNewline ? parsed.newline : ""),
    missing,
  };
}

function getSiteDef() {
  const text = fs.readFileSync(siteDefPath, "utf8");
  return { text, ...parseDef(text) };
}

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) results.push(...listFilesRecursive(full));
    if (item.isFile()) results.push(full);
  }
  return results;
}

function listImages(defEntries = []) {
  const refs = new Map();
  for (const entry of defEntries) {
    const value = String(entry.value || "").replace(/^\.\//, "");
    if (value.startsWith("images/")) refs.set(value, [...(refs.get(value) || []), entry.key]);
  }
  return listFilesRecursive(imagesDir)
    .filter((file) => imageExts.has(path.extname(file).toLowerCase()))
    .map((file) => {
      const stat = fs.statSync(file);
      const fileRel = rel(file);
      return {
        name: path.basename(file),
        path: fileRel,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        referencedBy: refs.get(fileRel) || [],
        warning: stat.size >= 3 * 1024 * 1024 ? "strong" : stat.size >= 1024 * 1024 ? "warn" : "",
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

async function diffSiteDef() {
  const diff = await runGit(["diff", "--", "content/site.def"]);
  return diff.stdout;
}

async function changedFiles() {
  const out = await runGit(["status", "--porcelain"]);
  return out.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => ({ status: line.slice(0, 2), path: line.slice(3) }));
}

function allowedCommitPath(file) {
  return (
    file === "content/site.def" ||
    file === "package.json" ||
    file === "README.md" ||
    file.startsWith("tools/site-editor/") ||
    file.startsWith("images/") ||
    file.startsWith("backup/images/")
  );
}

async function state() {
  const def = getSiteDef();
  const entries = def.lines.filter((line) => line.type === "entry");
  const imageKeys = entries.filter((entry) => {
    const key = entry.key.toLowerCase();
    const value = String(entry.value || "").toLowerCase();
    return key.includes("image") || key.includes("visual") || key.includes("photo") || key.includes("logo") || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(value);
  });
  const status = await gitStatus();
  return {
    status,
    defaultBranchName: defaultBranchName(),
    siteDef: { entries, warnings: def.warnings },
    imageKeys,
    images: listImages(entries),
    changedFiles: await changedFiles(),
    diff: await diffSiteDef(),
    head: await runGit(["log", "--oneline", "-1"]),
  };
}

function defaultBranchName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `feature/update-site-def-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function api(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/__site_editor/api/state") {
      return send(res, 200, await state());
    }

    if (req.method === "POST" && url.pathname === "/__site_editor/api/save") {
      const status = await gitStatus();
      if (status.isMain) return send(res, 409, { ok: false, message: "main ブランチ上では保存できません。派生ブランチを作成してください。" });
      const body = await readJson(req);
      const def = getSiteDef();
      const built = buildDef(def, body.values || {});
      if (built.missing.length) return send(res, 400, { ok: false, message: "削除された key があります。再読み込みしてください。", missing: built.missing });
      fs.writeFileSync(siteDefPath, built.text, "utf8");
      return send(res, 200, { ok: true, message: "content/site.def を保存しました。", state: await state() });
    }

    if (req.method === "POST" && url.pathname === "/__site_editor/api/branch") {
      const body = await readJson(req);
      const branchName = String(body.branchName || "").trim();
      if (!allowedBranch.test(branchName)) return send(res, 400, { ok: false, message: "ブランチ名は英数字、ハイフン、アンダースコア、スラッシュのみ使えます。" });
      const exists = await runGit(["rev-parse", "--verify", `refs/heads/${branchName}`]);
      if (exists.ok) return send(res, 409, { ok: false, message: "既に存在するブランチ名です。" });
      const status = await gitStatus();
      if (status.porcelain.length && !body.confirmDirty) {
        return send(res, 409, { ok: false, needsDirtyConfirm: true, message: "未commit変更があります。確認してからブランチを作成してください。", status: status.short });
      }
      let created = await runGit(["switch", "-c", branchName]);
      let command = "git switch -c";
      if (!created.ok) {
        created = await runGit(["checkout", "-b", branchName]);
        command = "git checkout -b";
      }
      if (!created.ok) return send(res, 500, { ok: false, message: created.stderr || "ブランチ作成に失敗しました。" });
      return send(res, 200, { ok: true, command, branchName, state: await state() });
    }

    if (req.method === "POST" && url.pathname === "/__site_editor/api/upload-image") {
      const status = await gitStatus();
      if (status.isMain) return send(res, 409, { ok: false, message: "main ブランチ上では画像を追加できません。派生ブランチを作成してください。" });
      const body = await readJson(req);
      const fileName = String(body.fileName || "").trim();
      if (!allowedFileName.test(fileName)) return send(res, 400, { ok: false, message: "ファイル名は英数字、ハイフン、アンダースコア、ドットのみ使えます。" });
      const ext = path.extname(fileName).toLowerCase();
      if (!imageExts.has(ext)) return send(res, 400, { ok: false, message: "対応していない画像形式です。" });
      const target = ensureInside(imagesDir, path.join(imagesDir, fileName));
      const exists = fs.existsSync(target);
      if (exists && !body.overwrite) return send(res, 409, { ok: false, needsOverwriteConfirm: true, message: "同名ファイルがあります。上書き確認が必要です。" });
      const data = Buffer.from(String(body.dataBase64 || ""), "base64");
      if (!data.length) return send(res, 400, { ok: false, message: "画像データが空です。" });
      if (exists) {
        fs.mkdirSync(backupImagesDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
        const backup = ensureInside(backupImagesDir, path.join(backupImagesDir, `${path.basename(fileName, ext)}-${stamp}${ext}`));
        fs.copyFileSync(target, backup);
      }
      fs.mkdirSync(imagesDir, { recursive: true });
      fs.writeFileSync(target, data);
      return send(res, 200, { ok: true, path: rel(target), size: data.length, state: await state() });
    }

    if (req.method === "GET" && url.pathname === "/__site_editor/api/commit-preview") {
      const status = await gitStatus();
      if (status.isMain) return send(res, 409, { ok: false, message: "main ブランチ上では commit できません。" });
      const files = (await changedFiles()).filter((file) => allowedCommitPath(file.path));
      const images = files.filter((file) => file.path.startsWith("images/") || file.path.startsWith("backup/images/"));
      return send(res, 200, { ok: true, branch: status.branch, files, images, diff: await diffSiteDef(), status: status.short });
    }

    if (req.method === "POST" && url.pathname === "/__site_editor/api/commit") {
      const status = await gitStatus();
      if (status.isMain) return send(res, 409, { ok: false, message: "main ブランチ上では commit できません。" });
      const body = await readJson(req);
      const message = String(body.message || "Update site.def content").trim();
      if (!message) return send(res, 400, { ok: false, message: "commit message を入力してください。" });
      const files = (await changedFiles()).filter((file) => allowedCommitPath(file.path)).map((file) => file.path);
      if (!files.length) return send(res, 400, { ok: false, message: "commit 対象の変更がありません。" });
      const add = await runGit(["add", "--", ...files]);
      if (!add.ok) return send(res, 500, { ok: false, message: add.stderr || "git add に失敗しました。" });
      const commit = await runGit(["commit", "-m", message]);
      if (!commit.ok) return send(res, 500, { ok: false, message: commit.stderr || "commit に失敗しました。" });
      const hash = await runGit(["rev-parse", "--short", "HEAD"]);
      return send(res, 200, { ok: true, hash: hash.stdout.trim(), output: commit.stdout, state: await state() });
    }

    if (req.method === "GET" && url.pathname === "/__site_editor/api/push-preview") {
      const status = await gitStatus();
      if (status.isMain) return send(res, 409, { ok: false, message: "main ブランチへの push はブロックされています。" });
      const remote = await runGit(["remote", "-v"]);
      const hash = await runGit(["rev-parse", "--short", "HEAD"]);
      const log = await runGit(["log", "--oneline", "-1"]);
      return send(res, 200, { ok: true, branch: status.branch, remote: remote.stdout.trim(), destination: `origin/${status.branch}`, hash: hash.stdout.trim(), log: log.stdout.trim(), status: status.short });
    }

    if (req.method === "POST" && url.pathname === "/__site_editor/api/push") {
      const status = await gitStatus();
      if (status.isMain) return send(res, 409, { ok: false, message: "main ブランチへの push はブロックされています。" });
      const body = await readJson(req);
      if (body.confirm !== "PUSHを許可") return send(res, 403, { ok: false, message: "確認欄に PUSHを許可 と正確に入力してください。" });
      const push = await runGit(["push", "-u", "origin", status.branch]);
      if (!push.ok) return send(res, 500, { ok: false, message: push.stderr || "push に失敗しました。" });
      const hash = await runGit(["rev-parse", "--short", "HEAD"]);
      return send(res, 200, { ok: true, branch: status.branch, hash: hash.stdout.trim(), output: push.stdout || push.stderr });
    }
  } catch (error) {
    return send(res, 500, { ok: false, message: error.message });
  }

  send(res, 404, { ok: false, message: "API not found" });
}

function serveStatic(req, res, url) {
  let file;
  if (url.pathname === "/__site_editor" || url.pathname === "/__site_editor/") {
    file = path.join(toolDir, "editor.html");
  } else {
    file = path.resolve(root, "." + decodeURIComponent(url.pathname));
  }
  try {
    ensureInside(root, file);
  } catch {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
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
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (url.pathname.startsWith("/__site_editor/api/")) return api(req, res, url);
  return serveStatic(req, res, url);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`site.def editor: http://127.0.0.1:${port}/__site_editor/`);
  console.log(`local preview:   http://127.0.0.1:${port}/`);
});
