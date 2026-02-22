const SYNC_KEY = "newtab_sync_v1"; // 숏컷/설정(동기화)
const LOCAL_KEY = "newtab_local_v1"; // 배경(로컬만)

const bg = document.getElementById("bg");
const grid = document.getElementById("grid");

const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const cancelBtn = document.getElementById("cancelBtn");

const addBtn = document.getElementById("addBtn");
const bgFile = document.getElementById("bgFile");
const colsSelect = document.getElementById("cols");

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

const dlg = document.getElementById("dlg");
const form = document.getElementById("form");
const nameInput = document.getElementById("name");
const urlInput = document.getElementById("url");
const dlgTitle = document.getElementById("dlgTitle");

const toneSelect = document.getElementById("tone");
const uiToneSelect = document.getElementById("uiTone");
const iconToneSelect = document.getElementById("iconTone");

let state = {
  bgDataUrl: "",
  columns: 6,
  tone: "normal",
  uiTone: "light",
  iconTone: "auto",
  shortcuts: [],
};

let editingId = null;
let dragId = null;

init();

async function init() {
  const syncData = await loadSync();
  const localData = await loadLocal();

  // syncData/localData를 state에 합치기
  state = { ...state, ...syncData, ...localData };

  applyBackground(state.bgDataUrl);
  applyTone(state.tone);
  if (toneSelect) toneSelect.value = state.tone;
  applyUiTone(state.uiTone);
  if (uiToneSelect) uiToneSelect.value = state.uiTone;
  applyIconTone(state.iconTone, state.uiTone);
  if (iconToneSelect) iconToneSelect.value = state.iconTone;

  applyColumns(state.columns);
  if (colsSelect) colsSelect.value = String(state.columns);

  if (!state.shortcuts || state.shortcuts.length === 0) {
    state.shortcuts = [
      {
        id: crypto.randomUUID(),
        name: "Google",
        url: "https://www.google.com",
      },
      {
        id: crypto.randomUUID(),
        name: "YouTube",
        url: "https://www.youtube.com",
      },
      { id: crypto.randomUUID(), name: "GitHub", url: "https://github.com" },
      { id: crypto.randomUUID(), name: "Naver", url: "https://www.naver.com" },
      {
        id: crypto.randomUUID(),
        name: "Baekjoon",
        url: "https://www.acmicpc.net",
      },
      {
        id: crypto.randomUUID(),
        name: "SWEA",
        url: "https://swexpertacademy.com",
      },
    ];
    await saveSync();
  }

  bindEvents();
  render();
  setTimeout(() => searchInput?.focus(), 50);
}

function bindEvents() {
  // 검색
  searchForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = (searchInput.value || "").trim();
    if (!q) return;
    window.location.href = guessUrlOrSearch(q);
  });

  // 설정 패널: 버튼 클릭
  settingsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePanel();
  });

  // 설정 패널 내부 클릭은 닫히지 않게
  settingsPanel?.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // 패널 바깥 클릭하면 닫기
  document.addEventListener("click", () => {
    closePanel();
  });

  // ESC로 패널 닫기
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePanel();
  });

  // 숏컷 추가
  addBtn?.addEventListener("click", () => {
    closePanel();
    editingId = null;
    dlgTitle.textContent = "숏컷 추가";
    nameInput.value = "";
    urlInput.value = "";
    dlg.showModal();
  });

  // 저장
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    if (!name || !url) return;

    if (editingId) {
      const idx = state.shortcuts.findIndex((s) => s.id === editingId);
      if (idx >= 0)
        state.shortcuts[idx] = { ...state.shortcuts[idx], name, url };
    } else {
      state.shortcuts.push({ id: crypto.randomUUID(), name, url });
    }

    await saveSync();
    dlg.close();
    render();
  });
  cancelBtn?.addEventListener("click", () => {
    dlg.close();
  });

  dlg?.addEventListener("cancel", (e) => {});

  // 배경 업로드
  bgFile?.addEventListener("change", async () => {
    const file = bgFile.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert("이미지가 너무 커요. 3MB 이하로 업로드 해주세요.");
      bgFile.value = "";
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    state.bgDataUrl = dataUrl;
    applyBackground(dataUrl);
    await saveLocal();
    bgFile.value = "";
  });

  toneSelect?.addEventListener("change", async () => {
    console.log("tone changed to:", toneSelect.value);
    state.tone = toneSelect.value; // "dark" | "normal" | "bright"
    applyTone(state.tone);
    await saveLocal();
  });
  uiToneSelect?.addEventListener("change", async () => {
    state.uiTone = uiToneSelect.value; // dark | light
    applyUiTone(state.uiTone);
    applyIconTone(state.iconTone, state.uiTone);
    await saveLocal();
  });
  iconToneSelect?.addEventListener("change", async () => {
    state.iconTone = iconToneSelect.value; // auto | dark | light
    applyIconTone(state.iconTone, state.uiTone);
    await saveLocal();
  });

  // columns
  colsSelect?.addEventListener("change", async () => {
    const v = parseInt(colsSelect.value, 10);
    state.columns = v;
    applyColumns(v);
    await saveLocal();
    render();
  });
}

function togglePanel() {
  const isHidden = settingsPanel.hasAttribute("hidden");
  if (isHidden) openPanel();
  else closePanel();
}

function openPanel() {
  settingsPanel.removeAttribute("hidden");
  settingsBtn.setAttribute("aria-expanded", "true");
}

function closePanel() {
  settingsPanel.setAttribute("hidden", "");
  settingsBtn.setAttribute("aria-expanded", "false");
}

function render() {
  grid.innerHTML = "";

  for (const s of state.shortcuts) {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.dataset.id = s.id;
    tile.draggable = true;

    tile.addEventListener("dragstart", onDragStart);
    tile.addEventListener("dragover", onDragOver);
    tile.addEventListener("drop", onDrop);
    tile.addEventListener("dragend", onDragEnd);

    const iconBtn = document.createElement("div");
    iconBtn.className = "iconBtn";
    iconBtn.title = normalizeUrl(s.url);
    iconBtn.onclick = () => (window.location.href = normalizeUrl(s.url));

    const img = document.createElement("img");
    img.className = "favicon";
    img.alt = "";
    img.loading = "lazy";
    const candidates = faviconCandidates(s.url);
    let idx = 0;
    img.src = candidates[idx];

    const fallback = document.createElement("div");
    fallback.className = "fallback";
    fallback.textContent = initialLetter(s.name);

    img.onerror = () => {
      idx++;
      if (idx < candidates.length) {
        img.src = candidates[idx];
        return;
      }
      img.remove();
      iconBtn.appendChild(fallback);
    };

    iconBtn.appendChild(img);

    const label = document.createElement("div");
    label.className = "label";
    label.textContent = s.name;
    label.title = s.name;

    const actions = document.createElement("div");
    actions.className = "tileActions";

    const edit = document.createElement("button");
    edit.className = "btn small";
    edit.textContent = "수정";
    edit.onclick = (e) => {
      e.stopPropagation();
      openEdit(s.id);
    };

    const del = document.createElement("button");
    del.className = "btn small ghost";
    del.textContent = "삭제";
    del.onclick = (e) => {
      e.stopPropagation();
      removeShortcut(s.id);
    };

    actions.append(edit, del);

    tile.append(iconBtn, label, actions);
    grid.append(tile);
  }
}

function openEdit(id) {
  const s = state.shortcuts.find((x) => x.id === id);
  if (!s) return;

  editingId = id;
  dlgTitle.textContent = "숏컷 수정";
  nameInput.value = s.name;
  urlInput.value = s.url;
  dlg.showModal();
}

async function removeShortcut(id) {
  state.shortcuts = state.shortcuts.filter((s) => s.id !== id);
  await saveSync();
  render();
}

//Drag & Drop
function onDragStart(e) {
  dragId = e.currentTarget.dataset.id;
  e.dataTransfer.effectAllowed = "move";
  e.currentTarget.classList.add("dragging");
}
function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}
async function onDrop(e) {
  e.preventDefault();
  const targetId = e.currentTarget.dataset.id;
  if (!dragId || dragId === targetId) return;

  const from = state.shortcuts.findIndex((s) => s.id === dragId);
  const to = state.shortcuts.findIndex((s) => s.id === targetId);
  if (from < 0 || to < 0) return;

  const [moved] = state.shortcuts.splice(from, 1);
  state.shortcuts.splice(to, 0, moved);

  await saveSync();
  render();
}
function onDragEnd(e) {
  e.currentTarget.classList.remove("dragging");
  dragId = null;
}

function guessUrlOrSearch(q) {
  if (/^https?:\/\//i.test(q)) return q;
  if (
    /^[\w.-]+\.[a-z]{2,}([/:].*)?$/i.test(q) ||
    /^localhost(:\d+)?(\/.*)?$/i.test(q)
  ) {
    return "https://" + q;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function applyBackground(dataUrl) {
  if (dataUrl) bg.style.backgroundImage = `url(${dataUrl})`;
  else bg.style.backgroundImage = "linear-gradient(135deg, #101010, #2b2b2b)";
}
function applyColumns(cols) {
  document.documentElement.style.setProperty("--cols", String(cols));
}
function faviconCandidates(url) {
  const u = new URL(normalizeUrl(url));
  const origin = u.origin;
  const domain = u.hostname;

  return [
    `${origin}/favicon.ico`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
  ];
}
function initialLetter(name) {
  const t = (name || "").trim();
  if (!t) return "•";
  return t[0].toUpperCase();
}
function normalizeUrl(url) {
  if (!/^https?:\/\//i.test(url)) return "https://" + url;
  return url;
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

//Storage
function loadSync() {
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    return new Promise((resolve) => {
      chrome.storage.sync.get([SYNC_KEY], (res) =>
        resolve(res[SYNC_KEY] ?? {}),
      );
    });
  }
  // 미리보기용 fallback
  try {
    return Promise.resolve(JSON.parse(localStorage.getItem(SYNC_KEY) || "{}"));
  } catch {
    return Promise.resolve({});
  }
}

function saveSync() {
  const data = { shortcuts: state.shortcuts }; // 숏컷만 동기화
  if (typeof chrome !== "undefined" && chrome.storage?.sync) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [SYNC_KEY]: data }, () => resolve());
    });
  }
  localStorage.setItem(SYNC_KEY, JSON.stringify(data));
  return Promise.resolve();
}

function loadLocal() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get([LOCAL_KEY], (res) =>
        resolve(res[LOCAL_KEY] ?? {}),
      );
    });
  }
  try {
    return Promise.resolve(JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}"));
  } catch {
    return Promise.resolve({});
  }
}

function saveLocal() {
  const data = {
    bgDataUrl: state.bgDataUrl,
    columns: state.columns,
    tone: state.tone,
    uiTone: state.uiTone,
    iconTone: state.iconTone,
  }; // 배경은 로컬
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [LOCAL_KEY]: data }, () => resolve());
    });
  }
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  return Promise.resolve();
}

function applyTone(tone) {
  const root = document.documentElement;

  if (tone === "normal") {
    // 원본
    root.style.setProperty("--scrim-mid", "0.04");
    root.style.setProperty("--scrim-dark", "0.12");
    root.style.setProperty("--scrim-white", "0.00");

    root.style.setProperty("--bg-brightness", "1");
    root.style.setProperty("--bg-contrast", "1");
    root.style.setProperty("--bg-saturate", "1");
  } else if (tone === "bright") {
    // light
    root.style.setProperty("--scrim-mid", "0.02");
    root.style.setProperty("--scrim-dark", "0.06");
    root.style.setProperty("--scrim-white", "0.06");

    root.style.setProperty("--bg-brightness", "1.12");
    root.style.setProperty("--bg-contrast", "1.05");
    root.style.setProperty("--bg-saturate", "1.05");
  } else {
    // dark
    root.style.setProperty("--scrim-mid", "0.18");
    root.style.setProperty("--scrim-dark", "0.55");
    root.style.setProperty("--scrim-white", "0.00");

    root.style.setProperty("--bg-brightness", "0.96");
    root.style.setProperty("--bg-contrast", "1.02");
    root.style.setProperty("--bg-saturate", "0.98");
  }
}
function applyUiTone(uiTone) {
  const root = document.documentElement;

  if (uiTone === "light") {
    // 화이트 UI
    root.style.setProperty("--ui-bg", "rgba(255,255,255,0.72)");
    root.style.setProperty("--ui-bg-strong", "rgba(255,255,255,0.86)");
    root.style.setProperty("--ui-border", "rgba(0,0,0,0.10)");
    root.style.setProperty("--ui-text", "rgba(0,0,0,0.88)");
    root.style.setProperty("--ui-muted", "rgba(0,0,0,0.62)");

    root.style.setProperty("--panel-bg", "rgba(255,255,255,0.92)");
    root.style.setProperty("--panel-border", "rgba(0,0,0,0.12)");
  } else {
    // 블랙 UI
    root.style.setProperty("--ui-bg", "rgba(0,0,0,0.22)");
    root.style.setProperty("--ui-bg-strong", "rgba(0,0,0,0.30)");
    root.style.setProperty("--ui-border", "rgba(255,255,255,0.18)");
    root.style.setProperty("--ui-text", "rgba(255,255,255,0.92)");
    root.style.setProperty("--ui-muted", "rgba(255,255,255,0.72)");

    root.style.setProperty("--panel-bg", "rgba(16,16,16,0.86)");
    root.style.setProperty("--panel-border", "rgba(255,255,255,0.20)");
  }
}
function applyIconTone(iconTone, uiTone) {
  const root = document.documentElement;

  // auto면 UI 톤 따라가기
  const mode = iconTone === "auto" ? uiTone : iconTone;

  if (mode === "light") {
    //light
    root.style.setProperty("--icon-bg", "rgba(255,255,255,0.78)");
    root.style.setProperty("--icon-border", "rgba(0,0,0,0.10)");
    root.style.setProperty("--icon-text", "rgba(0,0,0,0.86)");
  } else {
    // dark
    root.style.setProperty("--icon-bg", "rgba(0,0,0,0.25)");
    root.style.setProperty("--icon-border", "rgba(255,255,255,0.16)");
    root.style.setProperty("--icon-text", "rgba(255,255,255,0.92)");
  }
}
