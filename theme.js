/* XpiX theme switcher. Dark mode is the default; user choice is remembered. */
(() => {
  const root = document.documentElement;
  const storageKey = 'xpix-theme';
  let mode = 'dark';
  try {
    if (localStorage.getItem(storageKey) === 'light') mode = 'light';
  } catch {
    // Private browsing or restricted storage: dark mode still works.
  }

  root.dataset.theme = mode;
  root.style.colorScheme = mode;
  const initialThemeMeta = document.querySelector('meta[name="theme-color"]');
  if (initialThemeMeta) initialThemeMeta.setAttribute('content', mode === 'dark' ? '#0d1118' : '#f5f4f0');

  function start() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    const label = toggle.querySelector('[data-theme-label]');
    const icon = toggle.querySelector('[data-theme-icon]');

    function apply(nextMode) {
      mode = nextMode;
      root.dataset.theme = mode;
      root.style.colorScheme = mode;
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) metaThemeColor.setAttribute('content', mode === 'dark' ? '#0d1118' : '#f5f4f0');
      toggle.setAttribute('aria-pressed', String(mode === 'dark'));
      toggle.setAttribute(
        'aria-label',
        mode === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'
      );
      if (label) label.textContent = mode === 'dark' ? 'ТЕМНА' : 'СВІТЛА';
      if (icon) icon.textContent = mode === 'dark' ? '☾' : '☀';
    }

    apply(mode);
    toggle.addEventListener('click', () => {
      const next = mode === 'dark' ? 'light' : 'dark';
      apply(next);
      try { localStorage.setItem(storageKey, next); } catch { /* optional */ }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
