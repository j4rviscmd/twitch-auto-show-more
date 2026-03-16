/**
 * Twitch Auto Show More - popup.js
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  clickCount: 1,
};

const MIN_COUNT = 1;
const MAX_COUNT = 10;

// DOM要素の取得
const toggleEnabled = document.getElementById("toggle-enabled");
const inputClickCount = document.getElementById("input-click-count");
const btnDecrement = document.getElementById("btn-decrement");
const btnIncrement = document.getElementById("btn-increment");
const btnRunNow = document.getElementById("btn-run-now");
const statusMessage = document.getElementById("status-message");

/**
 * chrome.i18n を使って data-i18n 属性のある要素をローカライズする
 */
function localizeUI() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const message = chrome.i18n.getMessage(key);
    if (message) el.textContent = message;
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    const message = chrome.i18n.getMessage(key);
    if (message) el.setAttribute("aria-label", message);
  });
}

/**
 * ストレージから設定を読み込んでUIに反映する
 */
async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  toggleEnabled.checked = settings.enabled;
  inputClickCount.value = settings.clickCount;
  updateCountButtons(settings.clickCount);
}

/**
 * 設定をストレージに保存する
 */
async function saveSettings() {
  const enabled = toggleEnabled.checked;
  const clickCount = getValidCount();
  await chrome.storage.sync.set({ enabled, clickCount });
}

/**
 * 入力値を検証して有効な回数を返す
 * @returns {number}
 */
function getValidCount() {
  const raw = parseInt(inputClickCount.value, 10);
  if (isNaN(raw)) return DEFAULT_SETTINGS.clickCount;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, raw));
}

/**
 * ±ボタンの有効/無効状態を更新する
 * @param {number} count
 */
function updateCountButtons(count) {
  btnDecrement.disabled = count <= MIN_COUNT;
  btnIncrement.disabled = count >= MAX_COUNT;
}

/**
 * ステータスメッセージを表示する
 * @param {string} text
 * @param {"success"|"error"|""} type
 */
function showStatus(text, type = "") {
  statusMessage.textContent = text;
  statusMessage.className = "status-message " + type;
  if (text) {
    setTimeout(() => {
      statusMessage.textContent = "";
      statusMessage.className = "status-message";
    }, 2500);
  }
}

// --- イベントリスナー ---

toggleEnabled.addEventListener("change", saveSettings);

inputClickCount.addEventListener("change", () => {
  const count = getValidCount();
  inputClickCount.value = count;
  updateCountButtons(count);
  saveSettings();
});

btnDecrement.addEventListener("click", () => {
  const count = getValidCount();
  if (count > MIN_COUNT) {
    inputClickCount.value = count - 1;
    updateCountButtons(count - 1);
    saveSettings();
  }
});

btnIncrement.addEventListener("click", () => {
  const count = getValidCount();
  if (count < MAX_COUNT) {
    inputClickCount.value = count + 1;
    updateCountButtons(count + 1);
    saveSettings();
  }
});

btnRunNow.addEventListener("click", async () => {
  btnRunNow.disabled = true;
  showStatus("");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id || !tab.url?.includes("twitch.tv")) {
      showStatus(chrome.i18n.getMessage("statusErrorNotTwitch"), "error");
      return;
    }

    const clickCount = getValidCount();

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: manualClickShowMore,
      args: [clickCount],
    });

    if (result?.result?.success) {
      showStatus(chrome.i18n.getMessage("statusSuccess"), "success");
    } else {
      showStatus(
        result?.result?.error ?? chrome.i18n.getMessage("statusErrorFailed"),
        "error"
      );
    }
  } catch (error) {
    showStatus("Error: " + error.message, "error");
  } finally {
    btnRunNow.disabled = false;
  }
});

/**
 * content script コンテキストで実行される関数（executeScript に渡す）
 * @param {number} count
 * @returns {{ success: boolean, error?: string }}
 */
function manualClickShowMore(count) {
  const SELECTOR = '[data-a-target="side-nav-show-more-button"]';
  const INTERVAL_MS = 500;

  /**
   * @param {number} ms
   * @returns {Promise<void>}
   */
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  return (async () => {
    try {
      for (let i = 0; i < count; i++) {
        const buttons = document.querySelectorAll(SELECTOR);
        if (buttons.length === 0) break;
        buttons.forEach((btn) => btn.click());
        if (i < count - 1) await sleep(INTERVAL_MS);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  })();
}

// 初期化
localizeUI();
loadSettings();
