/**
 * =========================================================
 * main.js（劇団サイト）
 * - スマホメニュー（Drawer）制御
 * - ナビの現在地ハイライト（ScrollSpy）
 *
 * ✅ 運用メモ：
 * - HTML/CSSを触らずに挙動を調整したい場合は
 *   「CONFIG」だけ触ればOKにしてあります。
 * =========================================================
 */

/* =========================================================
 * CONFIG（ここだけ触れば大体調整できる）
 * ========================================================= */
const CONFIG = {
  // ===== ScrollSpy（現在地ハイライト） =====
  // 画面の「どの位置」を基準に現在地を決めるか（体感調整ポイント）
  // 0.33：画面の上から1/3付近 → “見えてきたら切り替わる”体感
  spyRatio: 0.33,

  // spyRatio で決めた基準線が大きくなりすぎるのを防ぐ上限（px）
  // 大画面で暴れる場合は小さく（例 200）、切り替えを早めたいなら大きく（例 280）
  spyMaxPx: 240,

  // stickyヘッダ分の補正（px）
  // headerの高さ + これ（余白）だけ下に基準線をずらす
  headerExtraOffset: 12,

  // ===== Drawer（スマホメニュー） =====
  // Drawerが開いたときの背景スクロールを止めるか
  lockBodyScroll: true,
};

/* =========================================================
 * ユーティリティ（触らなくてOK）
 * ========================================================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * requestAnimationFrame でスクロール処理を間引く（軽量化）
 * - スクロールのたびに重い処理を走らせないため
 */
const rafThrottle = (fn) => {
  let ticking = false;
  return (...args) => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      fn(...args);
    });
  };
};

/* =========================================================
 * 1) Drawer（スマホメニュー）制御
 * ========================================================= */
(() => {
  // --- HTML側の想定 ---
  // ボタン:  <button id="navToggle" aria-expanded="false">...</button>
  // ドロワ:  <div id="navDrawer" hidden> ... </div>
  const toggle = $("#navToggle");
  const drawer = $("#navDrawer");

  // Drawerが存在しない場合（PCだけ/未実装）でも落ちないようにする
  if (!toggle || !drawer) return;

  // 「閉じる」トリガー（背景クリック・×ボタンなど）に data-close-drawer を付ける想定
  const closeEls = $$("[data-close-drawer]", drawer);

  // Drawer内リンク（押したら閉じる）
  const drawerLinks = $$("a", drawer);

  // ===== アクセシビリティ用：Drawer内でTab移動を閉じ込める =====
  // 初心者メモ：
  // - Drawerを開いたままTabキーを押したとき、背景ページのリンクへ移動すると迷子になります。
  // - そのため「閉じるボタン」「Drawer内リンク」だけを順番に移動できるようにします。
  const focusableSelector = [
    "a[href]",
    "button:not([disabled])",
    "textarea:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");
  let lastFocusedEl = null;

  const getFocusableEls = () =>
    $$(focusableSelector, drawer).filter((el) => !el.hasAttribute("disabled"));

  function openDrawer() {
    // 開く前にフォーカスされていた要素を覚えておく。
    // 閉じたあと、メニューボタンへ自然に戻すため。
    lastFocusedEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    drawer.hidden = false;
    toggle.setAttribute("aria-expanded", "true");

    // ===== 編集ポイント：背景スクロール禁止 =====
    if (CONFIG.lockBodyScroll) document.body.style.overflow = "hidden";

    // Drawerが開いたら、まず閉じるボタンへフォーカスを移す。
    // キーボードだけで操作している人にも「メニューが開いた」と伝わりやすい。
    requestAnimationFrame(() => {
      const first = getFocusableEls()[0];
      if (first) first.focus();
    });
  }

  function closeDrawer(options = {}) {
    const { restoreFocus = true } = options;

    drawer.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (CONFIG.lockBodyScroll) document.body.style.overflow = "";

    // ESCや×ボタンで閉じたときは、開く前の場所へフォーカスを戻す。
    // リンクを押して閉じる場合は、移動先を邪魔しないよう restoreFocus:false にする。
    if (restoreFocus && lastFocusedEl) lastFocusedEl.focus();
    lastFocusedEl = null;
  }

  // トグルボタン：開閉
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    expanded ? closeDrawer() : openDrawer();
  });

  // 背景/×ボタンなど：閉じる
  closeEls.forEach((el) => el.addEventListener("click", closeDrawer));

  // Drawer内リンク：押したら閉じる（遷移の邪魔をしない）
  drawerLinks.forEach((a) => a.addEventListener("click", () => closeDrawer({ restoreFocus: false })));

  // ESCキーで閉じる / TabキーをDrawer内に閉じ込める（プロ仕様）
  document.addEventListener("keydown", (e) => {
    if (drawer.hidden) return;

    if (e.key === "Escape") {
      closeDrawer();
      return;
    }

    if (e.key !== "Tab") return;

    const focusableEls = getFocusableEls();
    if (focusableEls.length === 0) return;

    const first = focusableEls[0];
    const last = focusableEls[focusableEls.length - 1];

    // Shift + Tab で先頭より前へ行きそうなら最後へ戻す
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }

    // Tab で最後より後ろへ行きそうなら先頭へ戻す
    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
})();

/* =========================================================
 * 2) ScrollSpy（現在地ハイライト）
 * =========================================================
 * 目的：
 * - 「Schedule見てるのにNewsがアクティブ」のような違和感をなくす
 *
 * 方式：
 * - 画面内の「基準線（spyLine）」を超えた一番下のセクションを active にする
 *   ※ “最も見えてる”判定より、体感が安定しやすい
 * ========================================================= */
(() => {
  // PCナビ（上部ヘッダ）
  const pcLinks = $$('.nav a[href^="#"]');

  // Drawerナビ（スマホ）
  // ※HTMLによっては .drawer__links が無い場合もあるので安全に拾う
  const drawerRoot = $(".drawer__links") ?? $("#navDrawer") ?? document;
  const drawerLinks = $$('.drawer__links a[href^="#"]', document).length
    ? $$('.drawer__links a[href^="#"]', document)
    : $$('a[href^="#"]', drawerRoot);

  // 両方まとめて一括制御（同じ挙動になる）
  const allLinks = [...pcLinks, ...drawerLinks].filter(Boolean);

  // ナビが無いなら何もしない
  if (allLinks.length === 0) return;

  /**
   * href="#news" → document.querySelector("#news") のように対応付け
   * - 存在しないid（ミス）を除外
   * - 重複を除外
   */
  const sections = Array.from(
    new Set(
      allLinks
        .map((a) => $(a.getAttribute("href")))
        .filter((el) => el && el.id)
    )
  );

  // セクションが0なら何もしない
  if (sections.length === 0) return;

  /**
   * active付与処理
   * - .is-active を付ける（CSSで下線が出る想定）
   * - aria-current を付ける（アクセシビリティ）
   */
  const setActive = (id) => {
    allLinks.forEach((a) => {
      const on = a.getAttribute("href") === `#${id}`;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  };

  /**
   * 基準線（spyLine）のY座標を計算
   * - ヘッダの高さ分ズラす
   * - 画面上から spyRatio の位置に基準線を置く（上限 spyMaxPx）
   */
  const getSpyLineY = () => {
    // headerクラスが無い構成でも動くようにfallback
    const headerH = $(".header")?.offsetHeight ?? 64;

    // ヘッダ直下から少し余白を足す（見た目の体感調整）
    const offset = headerH + CONFIG.headerExtraOffset;

    // 画面上の基準線位置（上限あり）
    const spy = Math.min(CONFIG.spyMaxPx, window.innerHeight * CONFIG.spyRatio);

    // “ページ全体のY”に変換
    return window.scrollY + offset + spy;
  };

  /**
   * 現在地のセクションIDを計算
   * - spyLineを超えた中で一番下のsectionを current とする
   */
  const computeActive = () => {
    const y = getSpyLineY();

    // 一番下に近いときは最後を強制（末尾で変な揺れが出るのを防ぐ）
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 2) {
      return sections[sections.length - 1]?.id;
    }

    // デフォルトは先頭
    let current = sections[0]?.id;

    for (const sec of sections) {
      if (sec.offsetTop <= y) current = sec.id;
      else break; // secは上から順に並んでいる想定なので、超えたら終了
    }
    return current;
  };

  /**
   * スクロール時に更新（rafThrottleで軽量化）
   */
  const onScroll = rafThrottle(() => {
    const id = computeActive();
    if (id) setActive(id);
  });

  // クリック直後に即反映（スクロール前でも体感が良い）
  allLinks.forEach((a) => {
    a.addEventListener("click", () => {
      const href = a.getAttribute("href");
      if (href && href.startsWith("#")) setActive(href.slice(1));
    });
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  // 初期表示：URLに #hash が付いている場合はそれを優先
  if (location.hash) setActive(location.hash.replace("#", ""));

  // 初回判定
  onScroll();
})();


/* =========================================================
 * DEF / INI Loader（content/site.def を読み込んで画面反映）
 *
 * ✅ 目的：
 * - HTMLを触らずに、site.def だけで内容を更新できる
 * - 初心者は「1行 = 1項目（key = value）」を編集するだけ
 *
 * ✅ 運用：
 * - GitHub Pages でも動く（静的に fetch で読むだけ）
 * - site.def は index.html と同じ階層に置くのが一番ラク
 *
 * ⚠ 注意：
 * - Drive画像は「共有設定：リンクを知っている全員が閲覧可」
 * - Driveの共有URLはそのまま貼ってOK（JS側で表示用URLに変換する）
 * ========================================================= */

function isEmptySetting(value) {
  // site.def を編集する人が「空欄の意味」を書き残せるようにする。
  // 例：members.1.photo = なし
  // 例：hero.reserve.url = null
  //
  // 空欄でも動きますが、「あとで入れる」「今は使わない」が分かりやすいように
  // 代表的な空値ワードを空文字として扱います。
  const s = String(value ?? "").trim().toLowerCase();
  return ["", "null", "none", "n/a", "na", "-", "なし", "未設定"].includes(s);
}

function normalizeImageUrl(url) {
  if (isEmptySetting(url)) return "";
  if (!url) return "";
  const s = String(url).trim();
  if (!s) return "";
  const m1 = s.match(/\/file\/d\/([^\/]+)\//);
  if (m1 && m1[1]) return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(m1[1])}`;
  const m2 = s.match(/[?&]id=([^&]+)/);
  if (s.includes("drive.google.com/open") && m2 && m2[1]) {
    return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(m2[1])}`;
  }
  if (s.includes("drive.google.com/uc?") && s.includes("id=")) return s;
  return s;
}

function parseDef(text) {
  const root = {};

  const coerce = (v) => {
    const s = String(v ?? "").trim();
    const lower = s.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
    return s;
  };

  const isIndexPart = (part) => /^\d+$/.test(part);

  const setByPath = (obj, key, value) => {
    const parts = key.split(".").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return;
    let cur = obj;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const next = parts[i + 1];
      const nextIsIndex = next != null && isIndexPart(next);

      // 数字だけのキー（例：news.1.title の「1」）は配列の番号として扱う。
      // site.defでは人間が分かりやすいように 1 始まり、JS内部では 0 始まりに変換。
      if (isIndexPart(part)) {
        if (!Array.isArray(cur)) return;
        const idx = Math.max(0, parseInt(part, 10) - 1);
        while (cur.length <= idx) cur.push({});
        if (isLast) cur[idx] = value;
        else {
          if (cur[idx] == null || typeof cur[idx] !== "object") cur[idx] = {};
          cur = cur[idx];
        }
        continue;
      }

      if (isLast) {
        cur[part] = value;
        return;
      }

      if (nextIsIndex) {
        const existing = cur[part];

        // 初心者向けメモ：
        // schedule.sub と schedule.1.date のように、
        // 「説明文」と「一覧」が同じ schedule の中に混ざることがあります。
        //
        // その場合、schedule を配列に置き換えると sub/note が消えてしまうため、
        // 既にオブジェクトなら schedule.items に一覧を入れます。
        if (Array.isArray(existing)) {
          // news.1.title のような「一覧だけ」の項目は、そのまま配列として扱う。
        } else if (existing && typeof existing === "object") {
          if (!Array.isArray(existing.items)) existing.items = [];
          cur = existing.items;
          continue;
        } else {
          cur[part] = [];
        }
      } else {
        // もし先に schedule.1.date が読まれて schedule が配列になっていても、
        // 後から schedule.sub を読めるように { items: 配列 } へ包み直す。
        if (Array.isArray(cur[part])) cur[part] = { items: cur[part] };
        else if (cur[part] == null || typeof cur[part] !== "object") cur[part] = {};
      }
      cur = cur[part];
    }
  };

  const lines = String(text ?? "").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith(";") || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!key) continue;
    setByPath(root, key, coerce(value));
  }

  return normalizeState(root);
}

function normalizeState(raw) {
  const state = raw && typeof raw === "object" ? raw : {};

  // site.def の「news.1」「members.1」のような番号付き項目を、
  // 画面表示しやすい配列へそろえるための小さな補助関数。
  //
  // 例：
  // - news.1.title        → raw.news は配列になる
  // - schedule.sub + schedule.1.title → raw.schedule.items が配列になる
  //
  // この2パターンを同じように扱えるようにしておくと、編集順が変わっても壊れにくい。
  const listFrom = (value) => {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object" && Array.isArray(value.items)) return value.items;
    return [];
  };

  const objectFrom = (value) =>
    value && typeof value === "object" && !Array.isArray(value) ? value : {};

  state.hero = state.hero || {};
  const metaCards = [];
  for (let i = 1; i <= 3; i++) {
    const key = `meta${i}`;
    const m = state.hero[key];
    if (m && typeof m === "object") metaCards.push({ label: String(m.label ?? "").trim(), value: String(m.value ?? "").trim() });
  }
  if (Array.isArray(state.hero.metaCards) && state.hero.metaCards.length) {
    state.hero.metaCards = state.hero.metaCards.map((c) => ({ label: String(c?.label ?? "").trim(), value: String(c?.value ?? "").trim() }));
  } else state.hero.metaCards = metaCards;

  state.hero.reserve = state.hero.reserve || {};
  state.hero.detail = state.hero.detail || {};
  state.hero.keyVisual = state.hero.keyVisual || {};

  state.about = state.about || {};
  const history = listFrom(state.history);
  state.about.history = history.filter((h) => h && typeof h === "object").map((h) => ({ year: String(h.year ?? "").trim(), text: String(h.text ?? "").trim() }));

  state.news = listFrom(state.news);
  state.news = state.news.filter((n) => n && typeof n === "object").map((n) => ({
    date: String(n.date ?? "").trim(),
    title: String(n.title ?? "").trim(),
    text: String(n.text ?? "").trim(),
    url: String(n.url ?? "").trim(),
  })).filter((n) => n.date || n.title || n.text || n.url);

  const scheduleRaw = state.schedule;
  state.schedule = objectFrom(scheduleRaw);
  state.schedule.items = listFrom(scheduleRaw);
  state.schedule.items = state.schedule.items.filter((x) => x && typeof x === "object").map((x) => ({
    date: String(x.date ?? "").trim(),
    title: String(x.title ?? "").trim(),
    place: String(x.place ?? "").trim(),
    note: String(x.note ?? "").trim(),
    url: String(x.url ?? "").trim(),
  })).filter((x) => x.date || x.title || x.place || x.note || x.url);

  const pastRaw = state.past;
  state.past = objectFrom(pastRaw);
  state.past.items = listFrom(pastRaw);
  state.past.items = state.past.items.filter((x) => x && typeof x === "object").map((x) => ({
    year: String(x.year ?? "").trim(),
    title: String(x.title ?? "").trim(),
    text: String(x.text ?? "").trim(),
    photo: String(x.photo ?? "").trim(),
    url: String(x.url ?? "").trim(),
  })).filter((x) => x.year || x.title || x.text || x.photo || x.url);

  state.members = listFrom(state.members);
  state.members = state.members.filter((m) => m && typeof m === "object").map((m) => ({
    enabled: m.enabled === false ? false : true,
    name: String(m.name ?? "").trim(),
    role: String(m.role ?? "").trim(),
    note: String(m.note ?? "").trim(),
    photo: String(m.photo ?? "").trim(),
    snsLabel: String(m.snsLabel ?? "").trim(),
    snsUrl: String(m.snsUrl ?? "").trim(),
  })).filter((m) => m.name || m.role || m.note || m.photo || m.snsUrl);

  const socialsRaw = state.socials;
  state.socials = objectFrom(socialsRaw);
  state.socials.items = listFrom(socialsRaw);
  state.socials.items = (state.socials.items || []).filter((s) => s && typeof s === "object").map((s) => ({
    enabled: s.enabled === true || s.enabled === "true" || s.enabled === 1 || s.enabled === "1",
    label: String(s.label ?? "").trim(),
    title: String(s.title ?? "").trim(),
    text: String(s.text ?? "").trim(),
    url: String(s.url ?? "").trim(),
  })).filter((s) => s.label || s.title || s.text || s.url);

  state.meta = state.meta || {};
  state.theme = state.theme || {};
  state.branding = state.branding || {};
  state.branding.logo = state.branding.logo || {};
  state.contact = state.contact || {};
  state.footer = state.footer || {};

  const toStr = (obj, k) => { if (obj && obj[k] != null) obj[k] = String(obj[k]).trim(); };
  ["siteTitle","description","themeColor","ogTitle","ogDescription","ogImage","ogUrl"].forEach(k => toStr(state.meta,k));
  ["palette"].forEach(k => toStr(state.theme,k));
  ["troupeNameJp","troupeNameEn"].forEach(k => toStr(state.branding,k));
  ["src","alt"].forEach(k => toStr(state.branding.logo,k));
  ["sub","conceptTitle","concept","historyTitle"].forEach(k => toStr(state.about,k));
  ["sub","note"].forEach(k => toStr(state.schedule,k));
  ["sub"].forEach(k => toStr(state.past,k));
  ["sub","email"].forEach(k => toStr(state.contact,k));
  ["brand","small"].forEach(k => toStr(state.footer,k));
  if (state.hero.reserve) { toStr(state.hero.reserve, "label"); toStr(state.hero.reserve, "url"); }
  if (state.hero.detail) { toStr(state.hero.detail, "label"); toStr(state.hero.detail, "url"); }
  if (state.hero.keyVisual) { toStr(state.hero.keyVisual, "src"); toStr(state.hero.keyVisual, "alt"); }

  return state;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function textToHtmlWithBreaks(s) {
  // 初心者向けメモ：
  // textContent は安全ですが、改行を <br> として表示できません。
  // innerHTML は便利ですが、そのまま入れるとHTMLタグも実行されて危険です。
  //
  // そこで「先に escapeHtml で安全化 → 改行だけ <br> に変換」の順番にしています。
  // site.def 側で「\n」と書いても改行として扱えるようにしています。
  return escapeHtml(String(s ?? "").replace(/\\n/g, "\n")).replace(/\r?\n/g, "<br />");
}

function safeUrl(url) {
  if (isEmptySetting(url)) return "";

  const s = String(url ?? "").trim();
  if (!s) return "";

  // ページ内リンク（#contact など）は許可。
  if (s.startsWith("#")) return s;

  try {
    const parsed = new URL(s, window.location.href);
    const allowedProtocols = ["http:", "https:", "mailto:"];
    const isRelativePath = s.startsWith("/") || s.startsWith("./") || s.startsWith("../");

    // javascript: のような危険なURLを href に入れないための保険。
    if (isRelativePath || allowedProtocols.includes(parsed.protocol)) return s;
  } catch (e) {
    // URLとして解釈できない文字列は使わない。
  }

  console.warn(`[site.def] 安全ではないURLを無視しました: ${s}`);
  return "";
}

function isExternalUrl(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function cssUrl(url) {
  // background-image にURLを入れる時の最低限のエスケープ。
  // 画像URLは safeUrl を通したあと、CSS文字列として壊れないようにここも通す。
  return String(url ?? "").replace(/["\\\n\r]/g, "\\$&");
}

function linkHtml(label, url) {
  // innerHTMLでリンクを作る場所を1箇所にまとめる。
  // こうしておくと、あとから安全ルールを変えたい時もここだけ直せばOK。
  const href = safeUrl(url);
  if (!href) return escapeHtml(label);

  const target = isExternalUrl(href) ? ' target="_blank" rel="noopener"' : "";
  return `<a class="link" href="${escapeHtml(href)}"${target}>${escapeHtml(label)}</a>`;
}

function applyStateToDom(state) {
  const allowedThemes = ["soft-cream", "theater-classic", "black-gold", "literary-green", "pop-red"];
  const palette = state.theme?.palette || "soft-cream";

  // 初心者向けメモ：
  // CSS側に用意した配色プリセット名だけを許可しています。
  // site.def の theme.palette に違う文字を書いても、標準テーマに戻るので安心です。
  document.documentElement.dataset.theme = allowedThemes.includes(palette) ? palette : "soft-cream";

  if (state.meta?.siteTitle) {
    const pagePrefix = document.documentElement.dataset.titlePrefix || "";
    const siteName = state.branding?.troupeNameJp || state.meta.siteTitle;
    document.title = pagePrefix ? `${pagePrefix}｜${siteName}` : state.meta.siteTitle;
  }

  const setMeta = (selector, attr, value) => {
    const el = document.querySelector(selector);
    if (el && value != null && String(value).trim() !== "") el.setAttribute(attr, value);
  };
  setMeta('meta[name="description"]', "content", state.meta?.description);

  if (state.meta?.themeColor) {
    let theme = document.querySelector('meta[name="theme-color"]');
    if (!theme) {
      theme = document.createElement("meta");
      theme.setAttribute("name", "theme-color");
      document.head.appendChild(theme);
    }
    theme.setAttribute("content", state.meta.themeColor);
  }

  setMeta('meta[property="og:title"]', "content", state.meta?.ogTitle);
  setMeta('meta[property="og:description"]', "content", state.meta?.ogDescription);
  setMeta('meta[property="og:image"]', "content", state.meta?.ogImage);
  setMeta('meta[property="og:url"]', "content", state.meta?.ogUrl);

  const brandJp = document.querySelector(".brand__jp");
  const brandEn = document.querySelector(".brand__en");
  if (brandJp && state.branding?.troupeNameJp) brandJp.textContent = state.branding.troupeNameJp;
  if (brandEn && state.branding?.troupeNameEn) brandEn.textContent = state.branding.troupeNameEn;

  const brandMark = document.querySelector(".brand__mark");
  if (brandMark) {
    const src = state.branding?.logo?.src ? safeUrl(normalizeImageUrl(state.branding.logo.src)) : "";
    const alt = state.branding?.logo?.alt || "";

    // 初心者向けメモ：
    // branding.logo.src が空なら画像ロゴは表示しません。
    // 文字ロゴは残るので、画像が未準備でもヘッダーは崩れません。
    if (src) {
      brandMark.src = src;
      brandMark.alt = alt;
      brandMark.hidden = false;
    } else {
      brandMark.removeAttribute("src");
      brandMark.alt = "";
      brandMark.hidden = true;
    }
  }

  const heroBrandTitle = document.querySelector("[data-brand-title]");
  const heroBrandEn = document.querySelector("[data-brand-en]");
  const heroBadge = document.querySelector(".hero .badge:not([data-brand-en])");
  const heroTitle = document.querySelector(".hero__title:not([data-brand-title])");
  const heroLead = document.querySelector(".hero__lead");
  const heroNote = document.querySelector(".hero__note");
  const heroActions = document.querySelector("[data-hero-actions]");
  const heroMetaCards = Array.from(document.querySelectorAll(".hero__meta .metaCard"));

  // トップの大きな見出しは「劇団名」を出します。
  // 次回公演タイトルは下の #show に出すので、site.def の hero.title の意味は変えません。
  if (heroBrandTitle && state.branding?.troupeNameJp) heroBrandTitle.textContent = state.branding.troupeNameJp;
  if (heroBrandEn && state.branding?.troupeNameEn) heroBrandEn.textContent = state.branding.troupeNameEn;
  if (heroBadge && state.hero?.badge) heroBadge.textContent = state.hero.badge;
  if (heroTitle && state.hero?.title) heroTitle.textContent = state.hero.title;
  if (heroLead && state.hero?.lead != null) heroLead.innerHTML = textToHtmlWithBreaks(state.hero.lead);

  if (heroMetaCards.length && Array.isArray(state.hero?.metaCards)) {
    state.hero.metaCards.slice(0, heroMetaCards.length).forEach((m, i) => {
      const card = heroMetaCards[i];
      const labelEl = card.querySelector(".metaCard__label");
      const valueEl = card.querySelector(".metaCard__value");
      if (labelEl && m.label) labelEl.textContent = m.label;
      if (valueEl && m.value) valueEl.textContent = m.value;
    });
  }

  if (heroActions) {
    heroActions.innerHTML = "";
    const addBtn = (label, url, primary) => {
      const href = safeUrl(url);
      if (!label || !href) return;
      const a = document.createElement("a");
      a.className = primary ? "btn btn--primary" : "btn btn--ghost";
      a.href = href;
      if (isExternalUrl(href)) { a.target = "_blank"; a.rel = "noopener"; }
      a.textContent = label;
      heroActions.appendChild(a);
    };
    addBtn(state.hero?.reserve?.label, state.hero?.reserve?.url, true);
    addBtn(state.hero?.detail?.label, state.hero?.detail?.url, false);
  }

  if (heroNote && state.hero?.note != null) heroNote.textContent = String(state.hero.note || "");

  const showSec = document.querySelector("#show");
  if (showSec) {
    const showEyebrow = showSec.querySelector(".section__eyebrow");
    const showTitle = showSec.querySelector("[data-show-title]");
    const showDate = showSec.querySelector("[data-show-date]");
    const showPlace = showSec.querySelector("[data-show-place]");
    const showPrice = showSec.querySelector("[data-show-price]");
    const showNote = showSec.querySelector("[data-show-note]");
    const showActions = showSec.querySelector("[data-show-actions]");
    const cards = Array.isArray(state.hero?.metaCards) ? state.hero.metaCards : [];

    if (showEyebrow && state.hero?.badge) showEyebrow.textContent = state.hero.badge;
    if (showTitle && state.hero?.title) showTitle.textContent = state.hero.title;
    if (showDate && cards[0]?.value) showDate.textContent = cards[0].value;
    if (showPlace && cards[1]?.value) showPlace.textContent = cards[1].value;
    if (showPrice && cards[2]?.value) showPrice.textContent = cards[2].value;
    if (showNote && state.hero?.note != null) showNote.textContent = String(state.hero.note || "");

    if (showActions) {
      showActions.innerHTML = "";
      const addBtn = (label, url, primary) => {
        const href = safeUrl(url);
        if (!label || !href) return;
        const a = document.createElement("a");
        a.className = primary ? "btn btn--primary" : "btn btn--ghost";
        a.href = href;
        if (isExternalUrl(href)) { a.target = "_blank"; a.rel = "noopener"; }
        a.textContent = label;
        showActions.appendChild(a);
      };
      addBtn(state.hero?.reserve?.label, state.hero?.reserve?.url, true);
      addBtn(state.hero?.detail?.label, state.hero?.detail?.url, false);
    }
  }

  const visual = document.querySelector(".hero__visual");
  if (visual) {
    const src = state.hero?.keyVisual?.src ? safeUrl(normalizeImageUrl(state.hero.keyVisual.src)) : "";
    const alt = state.hero?.keyVisual?.alt || state.hero?.title || "";
    if (src) {
      const ph = visual.querySelector(".hero__visualPlaceholder");
      if (ph) ph.remove();
      let img = visual.querySelector("img");
      if (!img) { img = document.createElement("img"); visual.appendChild(img); }
      img.src = src;
      img.alt = alt;
    }
  }

  const newsGrid = document.querySelector("#news .newsGrid");
  if (newsGrid && Array.isArray(state.news)) {
    newsGrid.innerHTML = "";
    const limit = parseInt(newsGrid.dataset.limit || "", 10);
    const newsItems = Number.isFinite(limit) && limit > 0 ? state.news.slice(0, limit) : state.news;

    // トップページは data-limit="3"、news.html は制限なし。
    // 同じ news.* データを使いながら、ページごとに表示件数だけ変えています。
    newsItems.forEach((n) => {
      const art = document.createElement("article");
      art.className = "card card--hover";
      art.innerHTML = `
        <p class="news__date">${escapeHtml(n.date)}</p>
        <h3 class="card__title">${linkHtml(n.title, n.url)}</h3>
        <p class="card__text">${escapeHtml(n.text)}</p>
      `.trim();
      newsGrid.appendChild(art);
    });
  }

  const scheduleGrid = document.querySelector("#schedule .scheduleGrid");
  if (scheduleGrid && Array.isArray(state.schedule?.items)) {
    const sub = document.querySelector("#schedule .section__sub");
    if (sub && state.schedule?.sub != null) sub.textContent = state.schedule.sub;

    scheduleGrid.innerHTML = "";
    state.schedule.items.forEach((it) => {
      const lines = [];
      if (it.place) lines.push(`会場：${it.place}`);
      if (it.note) lines.push(`備考：${it.note}`);
      const body = lines.map((s) => `${escapeHtml(s)}<br />`).join("").replace(/<br \/>\s*$/, "");

      const art = document.createElement("article");
      art.className = "card";
      art.innerHTML = `
        <p class="news__date">${escapeHtml(it.date)}</p>
        <h3 class="card__title">${linkHtml(it.title, it.url)}</h3>
        <p class="card__text">${body}</p>
      `.trim();
      scheduleGrid.appendChild(art);
    });

    // 注意書きはHTMLにも仮文があるため、追加ではなく「差し替え」にする。
    // 追加してしまうと、site.def 読み込み後に同じ注意書きが2つ並ぶことがあります。
    const existingNote =
      document.querySelector("#schedule [data-schedule-note]") ??
      document.querySelector("#schedule .note");

    if (state.schedule?.note) {
      const p = existingNote || document.createElement("p");
      p.className = "note";
      p.setAttribute("data-schedule-note", "true");
      p.textContent = state.schedule.note;
      if (!existingNote) scheduleGrid.parentElement?.appendChild(p);
    } else if (existingNote) {
      existingNote.remove();
    }
  }

  const pastGrid = document.querySelector("#past .pastGrid");
  if (pastGrid && Array.isArray(state.past?.items)) {
    const sub = document.querySelector("#past .section__sub");
    if (sub && state.past?.sub != null) sub.textContent = state.past.sub;

    pastGrid.innerHTML = "";
    state.past.items.forEach((it) => {
      const href = safeUrl(it.url);
      const photo = it.photo ? safeUrl(normalizeImageUrl(it.photo)) : "";
      const art = document.createElement(href ? "a" : "article");
      art.className = "pastCard card card--hover";

      // 写真が未設定でもカードの形は残します。
      // 初心者が後から past.n.photo に画像パスを入れれば、自動で差し替わります。
      const photoHtml = photo
        ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(it.title)}">`
        : `<span>NO IMAGE</span>`;

      if (href) {
        art.href = href;
        if (isExternalUrl(href)) { art.target = "_blank"; art.rel = "noopener"; }
      }

      art.innerHTML = `
        <div class="pastCard__photo">${photoHtml}</div>
        <p class="pastCard__year">${escapeHtml(it.year)}</p>
        <h3 class="card__title">${escapeHtml(it.title)}</h3>
        <p class="card__text">${escapeHtml(it.text)}</p>
      `.trim();
      pastGrid.appendChild(art);
    });
  }

  const aboutSec = document.querySelector("#about");
  if (aboutSec) {
    const sub = aboutSec.querySelector(".section__sub");
    if (sub && state.about?.sub != null) sub.textContent = state.about.sub;

    const intro = aboutSec.querySelector("[data-about-intro]");
    if (intro && state.about?.concept != null) intro.textContent = state.about.concept;

    const cards = Array.from(aboutSec.querySelectorAll(".card"));
    if (cards[0] && state.about?.conceptTitle) { const h3 = cards[0].querySelector(".card__title"); if (h3) h3.textContent = state.about.conceptTitle; }
    if (cards[1] && state.about?.historyTitle) { const h3 = cards[1].querySelector(".card__title"); if (h3) h3.textContent = state.about.historyTitle; }
    if (cards[0] && state.about?.concept != null) { const p = cards[0].querySelector(".card__text"); if (p) p.textContent = state.about.concept; }
    if (cards[1]) {
      const ul = cards[1].querySelector("ul.list");
      if (ul && Array.isArray(state.about?.history)) {
        ul.innerHTML = "";
        state.about.history.forEach((h) => {
          const li = document.createElement("li");
          li.innerHTML = `<span class="list__key">${escapeHtml(h.year)}</span><span class="list__val">${escapeHtml(h.text)}</span>`;
          ul.appendChild(li);
        });
      }
    }
  }

  const membersGrid = document.querySelector("#members .grid");
  if (membersGrid && Array.isArray(state.members)) {
    membersGrid.innerHTML = "";
    state.members.filter((m) => m.enabled !== false).forEach((m) => {
      const src = m.photo ? safeUrl(normalizeImageUrl(m.photo)) : "";
      const sns = m.snsUrl ? linkHtml(m.snsLabel || "SNS", m.snsUrl) : "";
      const avClass = src ? "avatar has-photo" : "avatar";
      const art = document.createElement("article");
      art.className = "card member card--hover";
      art.innerHTML = `
        <div class="${avClass}" aria-hidden="true"></div>
        <h3 class="member__name">${escapeHtml(m.name)}</h3>
        <p class="member__role">${escapeHtml(m.role)}</p>
        <p class="member__note">${escapeHtml(m.note)}</p>
        ${sns}
      `.trim();

      // 写真URLはHTML文字列へ直接入れず、styleプロパティで設定する。
      // 初心者メモ：URLや文章は「どこへ入れるか」で安全な書き方が変わります。
      const avatar = art.querySelector(".avatar");
      if (avatar && src) avatar.style.backgroundImage = `url("${cssUrl(src)}")`;

      membersGrid.appendChild(art);
    });
  }

  const socialsGrid = document.querySelector("#follow .grid");
  if (socialsGrid && Array.isArray(state.socials?.items)) {
    const sub = document.querySelector("#follow .section__sub");
    if (sub && state.socials?.sub != null) sub.textContent = state.socials.sub;
    socialsGrid.innerHTML = "";
    state.socials.items.filter((s) => s.enabled).forEach((s) => {
      const href = safeUrl(s.url);
      const card = document.createElement(href ? "a" : "article");
      card.className = "social card card--hover";

      // URLが空のときは、クリックできないカードとして表示する。
      // href="#" にすると、初心者が「リンクできている」と誤解しやすいため。
      if (href) {
        card.href = href;
        if (isExternalUrl(href)) { card.target = "_blank"; card.rel = "noopener"; }
      }

      card.innerHTML = `
        <p class="social__label">${escapeHtml(s.label)}</p>
        <h3 class="social__title">${escapeHtml(s.title)}</h3>
        <p class="card__text">${escapeHtml(s.text)}</p>
        <p class="social__go">${href ? "見に行く →" : "URL準備中"}</p>
      `.trim();
      socialsGrid.appendChild(card);
    });
  }

  const contactSec = document.querySelector("#contact");
  if (contactSec) {
    const sub = contactSec.querySelector(".section__sub");
    if (sub && state.contact?.sub != null) sub.textContent = state.contact.sub;
    const mailA = contactSec.querySelector('a[href^="mailto:"]');
    if (mailA && state.contact?.email) { mailA.href = `mailto:${state.contact.email}`; mailA.textContent = state.contact.email; }
  }

  const fBrand = document.querySelector(".footer__brand");
  const fSmall = document.querySelector(".footer__small");
  if (fBrand && state.footer?.brand) fBrand.textContent = state.footer.brand;
  if (fSmall && state.footer?.small) fSmall.textContent = state.footer.small;
}

async function loadAndApplyDef() {
  const candidates = ["./site.def", "./content/site.def"];
  let text = null;
  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      text = await res.text();
      break;
    } catch (e) {}
  }
  if (!text) {
    console.warn("[site.def] が見つからないため、HTMLの静的内容を表示します。");
    return;
  }
  try {
    const state = parseDef(text);
    applyStateToDom(state);
  } catch (e) {
    console.error(e);
    console.warn("[site.def] の解析に失敗しました。defの書式（key = value）を確認してください。");
  }
}

loadAndApplyDef();
