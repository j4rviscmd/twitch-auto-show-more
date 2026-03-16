/**
 * Twitch Auto Show More - popup.js
 */

/**
 * 拡張機能の多言語対応のための翻訳データ
 *
 * 英語(`en`)と日本語(`ja`)の翻訳を提供します。
 * 各言語には以下のキーが含まれます:
 * - `extensionName`: 拡張機能名
 * - `enableAutoClick`: 自動クリック有効化ラベル
 * - `clickCount`: クリック回数ラベル
 * - `clickCountHint`: クリック回数のヒントテキスト
 * - `btnDecrement`: 減らすボタンのaria-label
 * - `btnIncrement`: 増やすボタンのaria-label
 * - `runNow`: 実行ボタンテキスト
 * - `statusSuccess`: 成功ステータスメッセージ
 * - `statusErrorNotTwitch': Twitch以外でのエラーメッセージ
 * - `statusErrorFailed`: 実行失敗のエラーメッセージ
 * - `langToggle`: 言語切替ボタンテキスト
 *
 * @type {Object.<string, Object.<string, string>>}
 */
const TRANSLATIONS = {
  en: {
    extensionName: "Twitch Auto Show More",
    enableAutoClick: "Enable auto-click",
    clickCount: "Click count",
    clickCountHint: "Number of times to click \"Show More\" on page load (1–10)",
    btnDecrement: "Decrease",
    btnIncrement: "Increase",
    runNow: "Run Now",
    statusSuccess: "Done",
    statusErrorNotTwitch: "Please run this on a Twitch tab",
    statusErrorFailed: "Failed to execute",
    langToggle: "EN"
  },
  ja: {
    extensionName: "Twitch Auto Show More",
    enableAutoClick: "自動クリックを有効にする",
    clickCount: "クリック回数",
    clickCountHint: "ページ読み込み時に「さらに表示」を押す回数（1〜10）",
    btnDecrement: "減らす",
    btnIncrement: "増やす",
    runNow: "今すぐ実行",
    statusSuccess: "実行しました",
    statusErrorNotTwitch: "Twitch のタブで実行してください",
    statusErrorFailed: "実行に失敗しました",
    langToggle: "日本語"
  }
};

/**
 * 拡張機能のデフォルト設定値
 *
 * 初回インストール時や設定が存在しない場合に使用される値です。
 *
 * @type {Object}
 * @property {boolean} enabled - 自動クリック機能のデフォルト状態（有効）
 * @property {number} clickCount - デフォルトのクリック回数（1回）
 * @property {string} language - デフォルトの表示言語（英語）
 */
const DEFAULT_SETTINGS = {
  enabled: true,
  clickCount: 1,
  language: "en"
};

/** クリック回数の最小値 @constant {number} */
const MIN_COUNT = 1;

/** クリック回数の最大値 @constant {number} */
const MAX_COUNT = 10;

// DOM要素
const toggleEnabled = document.getElementById("toggle-enabled");
const inputClickCount = document.getElementById("input-click-count");
const btnDecrement = document.getElementById("btn-decrement");
const btnIncrement = document.getElementById("btn-increment");
const btnRunNow = document.getElementById("btn-run-now");
const statusMessage = document.getElementById("status-message");
const langToggle = document.getElementById("lang-toggle");

let currentLanguage = "en";

/**
 * UI要素を現在の言語設定に合わせてローカライズします
 *
 * `data-i18n`属性を持つ要素のテキストコンテンツと、`data-i18n-aria`属性を持つ要素の
 * aria-label属性を、現在選択されている言語の翻訳データに置き換えます。
 *
 * @example
 * ```html
 * <span data-i18n="enableAutoClick">自動クリックを有効にする</span>
 * <button data-i18n-aria="btnDecrement" aria-label="減らす">−</button>
 * ```
 */
function localizeUI() {
  const translations = TRANSLATIONS[currentLanguage];

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const message = translations[key];
    if (message) el.textContent = message;
  });

  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    const message = translations[key];
    if (message) el.setAttribute("aria-label", message);
  });

  if (langToggle) {
    langToggle.textContent = translations.langToggle;
  }
}

/**
 * Chrome Storage APIから拡張機能の設定を読み込み、UIを更新します
 *
 * 読み込む設定項目:
 * - `enabled`: 自動クリック機能の有効/無効
 * - `clickCount`: ページ読み込み時のクリック回数（1〜10）
 * - `language`: 表示言語（"en" または "ja"）
 *
 * 設定が存在しない場合は、`DEFAULT_SETTINGS`のデフォルト値が使用されます。
 *
 * @async
 * @returns {Promise<void>} 設定の読み込みとUI更新が完了すると解決されます
 */
async function loadSettings() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  toggleEnabled.checked = settings.enabled;
  inputClickCount.value = settings.clickCount;
  updateCountButtons(settings.clickCount);
  currentLanguage = settings.language || "en";
  localizeUI();
}

/**
 * 現在のUI状態をChrome Storage APIに保存します
 *
 * 保存する設定項目:
 * - `enabled`: トグルスイッチの状態（自動クリックの有効/無効）
 * - `clickCount`: 入力フィールドの値（バリデーション済みの1〜10の範囲内）
 * - `language`: 現在選択されている言語
 *
 * @async
 * @returns {Promise<void>} 設定の保存が完了すると解決されます
 */
async function saveSettings() {
  const enabled = toggleEnabled.checked;
  const clickCount = getValidCount();
  await chrome.storage.sync.set({ enabled, clickCount, language: currentLanguage });
}

/**
 * 表示言語を英語と日本語で切り替えます
 *
 * 現在の言語に基づいて以下の切り替えを行います:
 * - 英語(`en`) → 日本語(`ja`)
 * - 日本語(`ja`) → 英語(`en`)
 *
 * 切り替え後の言語設定はChrome Storageに保存され、UIは即座に更新されます。
 *
 * @async
 * @returns {Promise<void>} 言語の保存とUI更新が完了すると解決されます
 */
async function switchLanguage() {
  currentLanguage = currentLanguage === "en" ? "ja" : "en";
  await chrome.storage.sync.set({ language: currentLanguage });
  localizeUI();
}

/**
 * クリック回数入力値をバリデーションし、有効な範囲内の値を返します
 *
 * バリデーションルール:
 * - 数値以外が入力された場合: デフォルト値（1）を返す
 * - `MIN_COUNT`(1) 未満: `MIN_COUNT` に制限
 * - `MAX_COUNT`(10) 超過: `MAX_COUNT` に制限
 * - 有効な範囲内: 入力値をそのまま返す
 *
 * @returns {number} バリデーション済みのクリック回数（1〜10の範囲内）
 */
function getValidCount() {
  const raw = parseInt(inputClickCount.value, 10);
  if (isNaN(raw)) return DEFAULT_SETTINGS.clickCount;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, raw));
}

/**
 * クリック回数調整ボタンの有効/無効状態を更新します
 *
 * 指定された回数に基づいて、以下のボタンの状態を制御します:
 * - 減らすボタン(`btnDecrement`): 最小値(1)以下で無効化
 * - 増やすボタン(`btnIncrement`): 最大値(10)以上で無効化
 *
 * @param {number} count - 現在のクリック回数
 */
function updateCountButtons(count) {
  btnDecrement.disabled = count <= MIN_COUNT;
  btnIncrement.disabled = count >= MAX_COUNT;
}

/**
 * ステータスメッセージを表示し、一定時間後に自動的に消去します
 *
 * メッセージの種類に応じて色分けされます:
 * - 空文字列または未指定: デフォルト（灰色）
 * - `"success"`: 成功メッセージ（緑色）
 * - `"error"`: エラーメッセージ（赤色）
 *
 * メッセージは2.5秒後に自動的に消去されます。
 *
 * @param {string} text - 表示するステータスメッセージ
 * @param {"success"|"error"|""} [type=""] - メッセージの種類
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

// イベントリスナー
langToggle.addEventListener("click", switchLanguage);
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
      showStatus(TRANSLATIONS[currentLanguage].statusErrorNotTwitch, "error");
      return;
    }

    const clickCount = getValidCount();

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: manualClickShowMore,
      args: [clickCount],
    });

    if (result?.result?.success) {
      showStatus(TRANSLATIONS[currentLanguage].statusSuccess, "success");
    } else {
      showStatus(
        result?.result?.error ?? TRANSLATIONS[currentLanguage].statusErrorFailed,
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
 * Content script コンテキストで実行される関数
 * @param {number} count
 * @returns {{ success: boolean, error?: string }}
 */
function manualClickShowMore(count) {
  const SELECTOR = '[data-a-target="side-nav-show-more-button"]';
  const INTERVAL_MS = 500;

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
loadSettings();
