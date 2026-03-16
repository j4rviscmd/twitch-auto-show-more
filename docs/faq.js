/**
 * FAQアコーディオン機能の初期化
 *
 * FAQ項目の質問をクリックした際、アコーディオン形式で回答を表示・非表示切り替えを行います。
 * 複数のFAQ項目のうち、常に1つのみが開いた状態を維持します。
 *
 * @example
 * ```html
 * <div class="faq-item">
 *   <div class="faq-question">質問テキスト</div>
 *   <div class="faq-answer">回答テキスト</div>
 * </div>
 * ```
 */
function initFAQAccordion() {
  document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
      const item = question.parentElement;
      const isActive = item.classList.contains('active');

      // Close all items
      document.querySelectorAll('.faq-item').forEach(i => {
        i.classList.remove('active');
      });

      // Open clicked item if it wasn't active
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

// FAQアコーディオンを初期化
initFAQAccordion();
