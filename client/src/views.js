// Switches between the app's views (Monitor, History, Tuning, Diagnostics).
// The current view is kept in the URL hash (#history, ...), so the browser's
// back button and bookmarks work. Hidden views stay in the page, so detection
// keeps updating them in the background.

const TITLES = { monitor: 'Monitor', history: 'History', tuning: 'Tuning', diagnostics: 'Diagnostics' };

export function setupViews({ onShow } = {}) {
  const views = document.querySelectorAll('[data-view]');
  const links = document.querySelectorAll('[data-view-link]');
  const title = document.getElementById('view-title');

  function show() {
    const name = TITLES[location.hash.slice(1)] ? location.hash.slice(1) : 'monitor';
    views.forEach((view) => (view.hidden = view.dataset.view !== name));
    links.forEach((link) => {
      if (link.dataset.viewLink === name) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    title.textContent = TITLES[name];
    onShow?.(name);
  }
  window.addEventListener('hashchange', show);
  show();

  // Collapse the sidebar to icons only; remembered on this device.
  const app = document.getElementById('app');
  const toggle = document.getElementById('sidebar-toggle');
  const setCollapsed = (collapsed) => {
    app.classList.toggle('collapsed', collapsed);
    toggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    toggle.title = toggle.getAttribute('aria-label');
    try {
      localStorage.setItem('eyestrain.sidebarCollapsed', collapsed ? '1' : '0');
    } catch {}
  };
  let initial = false;
  try {
    initial = localStorage.getItem('eyestrain.sidebarCollapsed') === '1';
  } catch {}
  setCollapsed(initial);
  toggle.addEventListener('click', () => setCollapsed(!app.classList.contains('collapsed')));
}
