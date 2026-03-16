/**
 * Twitch Auto Show More - content.js
 * ページ読み込み時に「さらに表示」ボタンを自動クリックする
 *
 * Twitch は SPA のため、content script 実行時点でサイドバーがまだ描画されていない。
 * MutationObserver でボタンの出現を監視し、出現後に自動クリックを実行する。
 * サイドバーの最初の状態を記憶し、show more 実行後に元の状態に戻す。
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
 * サイドバーの最初の状態を判定する
 * @returns {'open' | 'closed' | 'unknown'}
 */
function getInitialSidebarState() {
  // 最初に存在する要素で状態を判定する
  if (document.querySelector(SHOW_MORE_SELECTOR)) {
    return 'open'; // show-more-buttonが存在 → 最初から開いている
  }

  if (document.querySelector(SIDEBAR_TOGGLE_SELECTOR)) {
    // この要素が存在していても、実際にはサイドバーが開いている可能性がある
    // 展開ボタンが表示されるのは「閉じている」場合のみ
    // TwitchのUIでは、サイドバーが開いている場合は閉じるボタンが表示される
    const collapseBtn = document.querySelector('[data-a-target="side-nav-close-tray-button"]');
    if (collapseBtn) {
      return 'open'; // 閉じるボタンが存在 → 最初から開いている
    }
    return 'closed';
  }

  return 'unknown';
}

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

  // サイドバーのDOMが完全に描画されるまで待機してから状態を判定
  await sleep(500);
  const initialSidebarState = getInitialSidebarState();

  // 最初から開いている場合: show more のみ実行して終了
  if (initialSidebarState === 'open') {
    await clickShowMoreButtons(settings.clickCount);
    return;
  }

  // 状態が不明な場合: show more のみ実行して終了（安全策）
  if (initialSidebarState === 'unknown') {
    await clickShowMoreButtons(settings.clickCount);
    return;
  }

  // 最初から閉じていた場合: 展開 → show more → 折りたたむ
  if (initialSidebarState === 'closed') {
    await tryExpandSidebar();
    const foundAfterExpand = await waitForElement(SHOW_MORE_SELECTOR, AFTER_EXPAND_WAIT_MS);
    if (foundAfterExpand) {
      await clickShowMoreButtons(settings.clickCount);
      // show more 完了後にサイドバーを元通り閉じる
      await tryCollapseSidebar();
    }
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
