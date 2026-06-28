const api = (path, options = {}) =>
  fetch(`/__site_editor/api/${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  }).then(async (res) => {
    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  });

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let appState = null;
let selectedImage = null;
let currentPreviewPage = "/index.html";
let pushPreviewReady = false;

function bytes(size) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

function setNotice(el, text, type = "") {
  el.textContent = text || "";
  el.className = `notice ${type}`.trim();
}

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[ch]));
}

function render() {
  if (!appState) return;
  const { status, siteDef, images, imageKeys, changedFiles, diff, defaultBranchName } = appState;
  $("#currentBranch").textContent = status.branch;
  $("#branchName").value ||= defaultBranchName;
  $("#gitStatus").textContent = status.short || "クリーン";
  $("#diffBox").textContent = diff || "差分なし";

  const onMain = status.isMain;
  $("#saveDef").disabled = onMain;
  $("#commitButton").disabled = onMain;
  $("#pushPreviewButton").disabled = onMain;
  $("#pushButton").disabled = onMain || !pushPreviewReady || $("#pushConfirm").value !== "PUSHを許可";
  setNotice($("#branchNotice"), onMain ? "main ブランチ上では保存・commit・push 前に派生ブランチを作成してください。" : "派生ブランチで作業中です。", onMain ? "warn" : "ok");

  $("#warnings").innerHTML = siteDef.warnings.length
    ? siteDef.warnings.map((w) => `<div>行 ${w.line || "-"}: ${escapeHtml(w.message)}</div>`).join("")
    : "";

  $("#defRows").innerHTML = siteDef.entries.map((entry) => {
    const multiline = entry.value.includes("\\n") || entry.value.length > 80;
    const control = multiline
      ? `<textarea data-index="${entry.index}" rows="2">${escapeHtml(entry.value)}</textarea>`
      : `<input data-index="${entry.index}" value="${escapeHtml(entry.value)}">`;
    return `<tr><td>${escapeHtml(entry.key)}</td><td>${control}</td></tr>`;
  }).join("");

  $("#imageKeySelect").innerHTML = imageKeys.map((entry) =>
    `<option value="${entry.index}">${escapeHtml(entry.key)}</option>`
  ).join("");
  $("#imageKeyRefs").innerHTML = imageKeys.length
    ? imageKeys.map((entry) => `<div class="ref-row"><code>${escapeHtml(entry.key)}</code><span>${escapeHtml(entry.value || "(空欄)")}</span></div>`).join("")
    : "画像参照らしい key は見つかりませんでした。";

  renderImages(images);
  renderChangedFiles(changedFiles);
}

function renderImages(images) {
  $("#imageList").innerHTML = images.length ? images.map((image) => {
    const warning = image.warning ? `<span class="badge ${image.warning}">${image.warning === "strong" ? "3MB以上" : "1MB以上"}</span>` : `<span class="badge">OK</span>`;
    const used = image.referencedBy.length ? `<span class="badge">使用中</span>` : `<span class="badge">未使用</span>`;
    return `
      <button class="image-item ${selectedImage?.path === image.path ? "active" : ""}" data-path="${escapeHtml(image.path)}" type="button">
        <img class="thumb" src="/${encodeURI(image.path)}?v=${Date.now()}" alt="">
        <span class="image-meta">
          <strong>${escapeHtml(image.name)}</strong>
          <small>${escapeHtml(image.path)}</small>
          <small>${bytes(image.size)} / ${new Date(image.modified).toLocaleString()}</small>
          ${used} ${warning}
        </span>
      </button>`;
  }).join("") : "<p>images/ 配下に画像がありません。</p>";

  $$(".image-item").forEach((button) => {
    button.addEventListener("click", () => {
      selectedImage = appState.images.find((image) => image.path === button.dataset.path);
      renderSelectedImage();
      renderImages(appState.images);
    });
  });

  if (selectedImage) {
    selectedImage = appState.images.find((image) => image.path === selectedImage.path) || null;
  }
  renderSelectedImage();
}

function renderSelectedImage() {
  const img = $("#selectedImage");
  if (!selectedImage) {
    img.removeAttribute("src");
    $("#selectedImageMeta").textContent = "画像を選択してください。";
    $("#imageRefs").textContent = "";
    return;
  }
  img.src = `/${encodeURI(selectedImage.path)}?v=${Date.now()}`;
  $("#selectedImageMeta").textContent = `${selectedImage.path} / ${bytes(selectedImage.size)}`;
  $("#imageRefs").innerHTML = selectedImage.referencedBy.length
    ? selectedImage.referencedBy.map((key) => `<div class="ref-row"><code>${escapeHtml(key)}</code><span>使用中</span></div>`).join("")
    : `<div class="ref-row"><code>${escapeHtml(selectedImage.path)}</code><span>未使用画像</span></div>`;
}

function renderChangedFiles(files) {
  $("#commitFiles").innerHTML = files.length
    ? files.map((file) => `<div class="ref-row"><code>${escapeHtml(file.path)}</code><span>${escapeHtml(file.status)}</span></div>`).join("")
    : "変更ファイルはありません。";
}

async function loadState() {
  pushPreviewReady = false;
  appState = await api("state");
  render();
}

function reloadPreview() {
  $("#preview").src = `${currentPreviewPage}?v=${Date.now()}`;
}

function currentValues() {
  const values = {};
  $$("#defRows [data-index]").forEach((input) => {
    values[input.dataset.index] = input.value;
  });
  return values;
}

async function createBranch(confirmDirty = false) {
  try {
    const data = await api("branch", {
      method: "POST",
      body: JSON.stringify({ branchName: $("#branchName").value.trim(), confirmDirty }),
    });
    appState = data.state;
    setNotice($("#branchNotice"), `${data.command} ${data.branchName} を実行しました。`, "ok");
    render();
  } catch (error) {
    if (error.needsDirtyConfirm) {
      const ok = window.confirm(`${error.message}\n\n${error.status}\n\nこの状態で派生ブランチを作成しますか？`);
      if (ok) return createBranch(true);
    }
    setNotice($("#branchNotice"), error.message || "ブランチ作成に失敗しました。", "error");
  }
}

async function saveDef() {
  try {
    const data = await api("save", { method: "POST", body: JSON.stringify({ values: currentValues() }) });
    appState = data.state;
    render();
    reloadPreview();
  } catch (error) {
    setNotice($("#branchNotice"), error.message || "保存に失敗しました。", "error");
  }
}

function uploadFile(file, overwrite = false) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = String(reader.result).split(",")[1] || "";
        const data = await api("upload-image", {
          method: "POST",
          body: JSON.stringify({ fileName: file.name, dataBase64: base64, overwrite }),
        });
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("ファイル読み込みに失敗しました。"));
    reader.readAsDataURL(file);
  });
}

async function handleFile(file, overwrite = false) {
  if (!/^[A-Za-z0-9._-]+$/.test(file.name)) {
    setNotice($("#uploadNotice"), "日本語ファイル名・空白入りファイル名は使えません。英数字、ハイフン、アンダースコア、ドットのみです。", "error");
    return;
  }
  const extOk = /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(file.name);
  if (!extOk) {
    setNotice($("#uploadNotice"), "対応拡張子は .jpg .jpeg .png .webp .gif .svg です。", "error");
    return;
  }
  if (file.size >= 3 * 1024 * 1024) {
    setNotice($("#uploadNotice"), "3MB以上の大きい画像です。必要なら事前に圧縮してください。", "warn");
  } else if (file.size >= 1024 * 1024) {
    setNotice($("#uploadNotice"), "1MB以上の画像です。ページ表示速度に注意してください。", "warn");
  }
  try {
    const data = await uploadFile(file, overwrite);
    appState = data.state;
    selectedImage = appState.images.find((image) => image.path === data.path) || null;
    setNotice($("#uploadNotice"), `${data.path} を追加しました。`, "ok");
    render();
    reloadPreview();
  } catch (error) {
    if (error.needsOverwriteConfirm) {
      const ok = window.confirm("同名ファイルがあります。backup/images/ にバックアップを作成して上書きしますか？");
      if (ok) return handleFile(file, true);
    }
    setNotice($("#uploadNotice"), error.message || "画像追加に失敗しました。", "error");
  }
}

async function commitPreview() {
  try {
    const data = await api("commit-preview");
    const imageText = data.images.length
      ? `\n\n変更画像:\n${data.images.map((file) => `- ${file.status} ${file.path}`).join("\n")}`
      : "";
    $("#commitFiles").innerHTML = data.files.length
      ? data.files.map((file) => `<div class="ref-row"><code>${escapeHtml(file.path)}</code><span>${escapeHtml(file.status)}</span></div>`).join("")
      : "commit 対象の変更はありません。";
    window.alert(`commit前確認\n\nブランチ: ${data.branch}\n\n対象:\n${data.files.map((file) => `- ${file.status} ${file.path}`).join("\n") || "(なし)"}${imageText}`);
    return data;
  } catch (error) {
    setNotice($("#commitResult"), error.message || "commit前確認に失敗しました。", "error");
    throw error;
  }
}

async function commit() {
  try {
    const preview = await commitPreview();
    if (!preview.files.length) return;
    if (!window.confirm("表示された内容で commit を作成しますか？")) return;
    const data = await api("commit", {
      method: "POST",
      body: JSON.stringify({ message: $("#commitMessage").value }),
    });
    appState = data.state;
    pushPreviewReady = false;
    $("#pushPreview").textContent = "";
    $("#pushConfirm").value = "";
    render();
    setNotice($("#commitResult"), `commit を作成しました: ${data.hash}`, "ok");
  } catch (error) {
    setNotice($("#commitResult"), error.message || "commit に失敗しました。", "error");
  }
}

async function pushPreview() {
  try {
    const data = await api("push-preview");
    pushPreviewReady = true;
    $("#pushPreview").innerHTML = `
      <div class="ref-row"><code>現在ブランチ</code><span>${escapeHtml(data.branch)}</span></div>
      <div class="ref-row"><code>remote</code><span>${escapeHtml(data.remote || "(なし)")}</span></div>
      <div class="ref-row"><code>push先</code><span>${escapeHtml(data.destination)}</span></div>
      <div class="ref-row"><code>最新commit</code><span>${escapeHtml(data.hash)}</span></div>
      <div class="ref-row"><code>git log --oneline -1</code><span>${escapeHtml(data.log)}</span></div>
      <div class="ref-row"><code>git status</code><span>${escapeHtml(data.status || "クリーン")}</span></div>`;
    $("#pushButton").disabled = !appState || appState.status.isMain || $("#pushConfirm").value !== "PUSHを許可";
  } catch (error) {
    pushPreviewReady = false;
    $("#pushButton").disabled = true;
    setNotice($("#pushResult"), error.message || "push前確認に失敗しました。", "error");
  }
}

async function push() {
  try {
    const data = await api("push", {
      method: "POST",
      body: JSON.stringify({ confirm: $("#pushConfirm").value }),
    });
    setNotice($("#pushResult"), `push 完了: ${data.branch} / ${data.hash}`, "ok");
  } catch (error) {
    setNotice($("#pushResult"), error.message || "push に失敗しました。", "error");
  }
}

$("#reloadAll").addEventListener("click", loadState);
$("#refreshImages").addEventListener("click", loadState);
$("#resetForm").addEventListener("click", render);
$("#saveDef").addEventListener("click", saveDef);
$("#createBranch").addEventListener("click", () => createBranch(false));
$("#reloadPreview").addEventListener("click", reloadPreview);
$("#commitPreview").addEventListener("click", commitPreview);
$("#commitButton").addEventListener("click", commit);
$("#pushPreviewButton").addEventListener("click", pushPreview);
$("#pushButton").addEventListener("click", push);
$("#pushConfirm").addEventListener("input", () => {
  $("#pushButton").disabled = !appState || appState.status.isMain || !pushPreviewReady || $("#pushConfirm").value !== "PUSHを許可";
});
$("#applyImagePath").addEventListener("click", () => {
  if (!selectedImage) return;
  const index = $("#imageKeySelect").value;
  const input = $(`#defRows [data-index="${CSS.escape(index)}"]`);
  if (input) {
    input.value = selectedImage.path;
    input.focus();
  }
});

$("#previewTabs").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-page]");
  if (!button) return;
  currentPreviewPage = button.dataset.page;
  $$("#previewTabs button").forEach((item) => item.classList.toggle("active", item === button));
  reloadPreview();
});

$("#imageInput").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) handleFile(file);
  event.target.value = "";
});

const dropZone = $("#dropZone");
["dragenter", "dragover"].forEach((name) => {
  dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  });
});
["dragleave", "drop"].forEach((name) => {
  dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragover");
  });
});
dropZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;
  if (file) handleFile(file);
});

loadState().catch((error) => {
  document.body.innerHTML = `<pre style="padding:20px;color:#c23232;">${escapeHtml(error.message || String(error))}</pre>`;
});
