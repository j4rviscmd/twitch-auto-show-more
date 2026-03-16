/**
 * Twitch Auto Show More - content.js
 * ページ読み込み時に「さらに表示」ボタンを自動クリックする
 *
 * Twitch は SPA のため、content script 実行時点でサイドバーがまだ描画されていない。
 * MutationObserver でボタンの出現を監視し、出現後に自動クリックを実行する。
 * サイドバーが閉じている場合は自動で開いてから実行する。
 */

const SHOW_MORE_SELECTOR = '[data-a-target="side-nav-show-more-button"]';
const SIDEBAR_TOGGLE_SELECTOR = '[data-a-target="side-nav-arrow"]';
const DEFAULT_CLICK_COUNT = 1;
const CLICK_INTERVAL_MS = 500;

/** 初回のサイドバー要素（show-more or toggle）を待つタイムアウト（ms） */
const SIDEBAR_READY_WAIT_MS = 10000;
/** サイドバー展開後の再待機タイムアウト（ms） */
const AFTER_EXPAND_WAIT_MS = 5000;

/**
 * ストレージから設定を取得して自動クリックを実行する
 */
async function autoShowMore() {
  const settings = await chrome.storage.sync.get({
    enabled: true,
    clickCount: DEFAULT_CLICK_COUNT,
  });

  if (!settings.enabled) return;

  // show-more-button か side-nav-arrow のどちらかが出現するまで待つ
  const combinedSelector = `${SHOW_MORE_SELECTOR}, ${SIDEBAR_TOGGLE_SELECTOR}`;
  const found = await waitForElement(combinedSelector, SIDEBAR_READY_WAIT_MS);

  if (!found) return; // タイムアウト

  if (document.querySelector(SHOW_MORE_SELECTOR)) {
    // show-more-button が出現 → サイドバーは開いている
    await clickShowMoreButtons(settings.clickCount);
    return;
  }

  // side-nav-arrow が出現 → サイドバーが折りたたまれている → 展開する
  await tryExpandSidebar();
  const foundAfterExpand = await waitForElement(SHOW_MORE_SELECTOR, AFTER_EXPAND_WAIT_MS);
  if (foundAfterExpand) {
    await clickShowMoreButtons(settings.clickCount);
    // show more 完了後にサイドバーを元通り閉じる
    await tryCollapseSidebar();
  }
}

/**
 * 指定セレクタの要素が DOM に現れるまで待つ
 * @param {string} selector
 * @param {number} timeoutMs
 * @returns {Promise<boolean>} 見つかれば true、タイムアウトなら false
 */
function waitForElement(selector, timeoutMs) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      resolve(true);
      return;
    }

    let settled = false;

    const settle = (result) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timeoutId);
      resolve(result);
    };

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) settle(true);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const timeoutId = setTimeout(() => settle(false), timeoutMs);
  });
}

/**
 * サイドバートグルボタンをクリックして展開を試みる
 * @returns {Promise<boolean>} クリックできれば true
 */
async function tryExpandSidebar() {
  const toggleBtn = document.querySelector(SIDEBAR_TOGGLE_SELECTOR);
  if (!toggleBtn) return false;
  toggleBtn.click();
  return true;
}

/**
 * サイドバートグルボタンをクリックして折りたたむ
 * show more 実行後に元の状態（閉じた状態）に戻すために使用
 * @returns {Promise<boolean>} クリックできれば true
 */
async function tryCollapseSidebar() {
  // 展開後はトグルボタンのセレクタが変わる可能性があるため
  // サイドバーの閉じるボタン (collapse) を探す
  const collapseSelector = '[data-a-target="side-nav-close-tray-button"], [data-a-target="side-nav-arrow"]';
  const closeBtn = document.querySelector(collapseSelector);
  if (!closeBtn) return false;
  closeBtn.click();
  return true;
}

/**
 * 「さらに表示」ボタンを指定回数クリックする
 * @param {number} count - クリック回数
 */
async function clickShowMoreButtons(count) {
  for (let i = 0; i < count; i++) {
    const buttons = document.querySelectorAll(SHOW_MORE_SELECTOR);
    if (buttons.length === 0) break;

    buttons.forEach((button) => button.click());

    if (i < count - 1) {
      await sleep(CLICK_INTERVAL_MS);
    }
  }
}

/**
 * 指定ミリ秒待機する
 * @param {number} ms - 待機時間（ミリ秒）
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * popup からのメッセージを受け取って手動実行する
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "MANUAL_SHOW_MORE") {
    clickShowMoreButtons(message.clickCount ?? DEFAULT_CLICK_COUNT)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // 非同期レスポンスのため true を返す
  }
});

// ページ読み込み時に自動実行
autoShowMore();
