/**
 * nav.js — shared site navigation (header + mobile sidebar)
 *
 * Include as the very first thing inside <body>, before any page content:
 *
 *   From the site root (index.html):
 *     <script src="nav.js" data-loc="root"></script>
 *
 *   From anything inside pages/:
 *     <script src="../nav.js" data-loc="pages"></script>
 *
 * It writes the nav markup synchronously (document.write), so it has to run
 * un-deferred at the point it appears in the HTML — that's what keeps the
 * nav from "popping in" after the rest of the page has rendered.
 *
 * Colors are pulled from each page's own CSS custom properties
 * (--nav, --nav-hover, --text, --bg) with sensible fallbacks, so every page
 * keeps its own theme — only the structure, dropdown and mobile-menu
 * behavior are centralized here.
 */
(function () {
  var thisScript = document.currentScript;
  var loc = (thisScript && thisScript.getAttribute('data-loc')) || 'pages';

  // rootBase: how to get from this page up to the site root (for the logo / home link)
  // pagesBase: how to get from this page to a sibling in pages/ (for all other nav links)
  var rootBase = loc === 'root' ? '' : '../';
  var pagesBase = loc === 'root' ? 'pages/' : '';

  var style = ''
    + '<style id="nav-js-styles">'
    + '.main-header { position: relative; width: 100%; z-index: 1000; }'
    + '.main-nav { max-width: 1200px; margin: 0 auto; padding: 20px 40px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }'
    + '.nav-left, .nav-right { display: flex; gap: 20px; align-items: center; }'
    + '.nav-left { justify-self: start; }'
    + '.nav-center { justify-self: center; }'
    + '.nav-right { justify-self: end; }'
    + '.nav-link { font-family: "IBM Plex Mono", monospace; font-size: 0.8rem; font-weight: 300; letter-spacing: 0.05em; color: var(--nav, var(--text, #1a1814)); text-decoration: none; transition: opacity 0.3s ease; white-space: nowrap; position: relative; }'
    + '.nav-link:visited, .nav-link:focus { color: var(--nav, var(--text, #1a1814)); text-decoration: none; }'
    + '.nav-link:hover { color: var(--nav-hover, var(--header, #3f4330)); text-decoration: none; opacity: 0.7; }'
    + '.nav-item-with-dropdown { position: relative; }'
    + '.dropdown-menu { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 12px; background: rgba(255, 255, 255, 0.95); border-radius: 8px; padding: 12px 0; min-width: 160px; opacity: 0; visibility: hidden; transition: all 0.3s ease; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }'
    + '@media (hover: hover) and (pointer: fine) { .nav-item-with-dropdown:hover .dropdown-menu { opacity: 1; visibility: visible; margin-top: 8px; } }'
    + '.nav-item-with-dropdown.active .dropdown-menu { opacity: 1; visibility: visible; margin-top: 8px; }'
    + '.dropdown-item { display: block; padding: 10px 20px; font-family: "IBM Plex Mono", monospace; font-size: 0.75rem; letter-spacing: 0.05em; color: #1a1814; text-decoration: none; transition: background 0.2s ease; }'
    + '.dropdown-item:hover { background: rgba(161, 177, 97, 0.2); }'
    + '.logo-link { display: block; transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }'
    + '.logo-link img { display: block; height: 60px; width: auto; }'
    + '.logo-link:hover { transform: scale(1.15); }'
    + '.hamburger-btn { display: none; flex-direction: column; justify-content: center; align-items: center; gap: 5px; width: 32px; height: 32px; background: none; border: none; cursor: pointer; z-index: 1100; padding: 0; }'
    + '.hamburger-btn span { display: block; width: 22px; height: 2px; background: var(--text, #1a1814); transition: transform 0.3s ease, opacity 0.3s ease; }'
    + '.hamburger-btn.active span:nth-child(1) { transform: translateY(7px) rotate(45deg); }'
    + '.hamburger-btn.active span:nth-child(2) { opacity: 0; }'
    + '.hamburger-btn.active span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }'
    + '.sidebar-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.45); z-index: 1150; opacity: 0; transition: opacity 0.3s ease; }'
    + '.sidebar-overlay.active { display: block; opacity: 1; }'
    + '.mobile-sidebar { position: fixed; top: 0; left: -85%; width: 85%; max-width: 300px; height: 100vh; background: var(--bg, #fffdf7); z-index: 1200; transition: left 0.35s ease; box-shadow: 2px 0 16px rgba(0, 0, 0, 0.25); padding: 90px 32px 40px; display: flex; flex-direction: column; gap: 28px; overflow-y: auto; }'
    + '.mobile-sidebar.active { left: 0; }'
    + '.sidebar-link { font-family: "IBM Plex Mono", monospace; font-size: 1.1rem; font-weight: 400; letter-spacing: 0.05em; color: var(--text, #1a1814); text-decoration: none; }'
    + '.sidebar-group-label { font-family: "IBM Plex Mono", monospace; font-size: 1.1rem; font-weight: 400; letter-spacing: 0.05em; color: var(--text, #1a1814); margin-bottom: 14px; }'
    + '.sidebar-sublinks { display: flex; flex-direction: column; gap: 14px; padding-left: 16px; }'
    + '.sidebar-sublinks a { font-family: "IBM Plex Mono", monospace; font-size: 0.85rem; letter-spacing: 0.05em; color: var(--muted, rgba(26, 24, 20, 0.65)); text-decoration: none; }'
    // Mobile menu text is always dark so it reads on every page background
    // (ID selectors beat the per-page sidebar overrides)
    + '#mobileSidebar .sidebar-link, #mobileSidebar .sidebar-group-label { color: #1a1814; }'
    + '#mobileSidebar .sidebar-sublinks a { color: #1a1814; opacity: 0.8; }'
    + '#mobileSidebar .sidebar-sublinks a:hover, #mobileSidebar .sidebar-link:hover { opacity: 0.6; }'
    // Shared footer: same look on every page, line + text match the nav link color
    + '.site-footer { border-top: 0.5px solid var(--footer-color, var(--nav, var(--text, #1a1814))) !important; background: transparent !important; padding: 28px 24px !important; text-align: center; font-family: "IBM Plex Mono", monospace; font-size: 0.58rem !important; font-weight: 300; letter-spacing: 0.14em !important; text-transform: uppercase; color: var(--footer-color, var(--nav, var(--text, #1a1814))) !important; }'
    + '@media (max-width: 768px) {'
    + '  .main-nav { position: relative; padding: 12px 16px; }'
    + '  .nav-left, .nav-right { display: none; }'
    + '  .hamburger-btn { display: flex; position: absolute; left: 16px; top: 50%; transform: translateY(-50%); }'
    + '  .nav-center { justify-self: end; grid-column: 3; }'
    + '  .logo-link img { height: 35px; }'
    + '  .dropdown-menu { left: 0; transform: none; min-width: 140px; }'
    + '}'
    + '</style>';

  var navHTML = ''
    + '<header class="main-header">'
    + '  <nav class="main-nav">'
    + '    <button class="hamburger-btn" id="hamburgerBtn" aria-label="Open menu">'
    + '      <span></span><span></span><span></span>'
    + '    </button>'
    + '    <div class="nav-left">'
    + '      <div class="nav-item-with-dropdown">'
    + '        <span class="nav-link" style="cursor: pointer;">Projects</span>'
    + '        <div class="dropdown-menu">'
    + '          <a href="' + pagesBase + 'projects.html" class="dropdown-item">Web App</a>'
    + '          <a href="' + pagesBase + 'projects-mobile.html" class="dropdown-item">Mobile App</a>'
    + '        </div>'
    + '      </div>'
    + '      <div class="nav-item-with-dropdown">'
    + '        <span class="nav-link" style="cursor: pointer;">Labs</span>'
    + '        <div class="dropdown-menu">'
    + '          <a href="' + pagesBase + 'labs-code.html" class="dropdown-item">Code</a>'
    + '          <a href="' + pagesBase + 'labs-visual.html" class="dropdown-item">Visual Design</a>'
    + '        </div>'
    + '      </div>'
    + '    </div>'
    + '    <div class="nav-center">'
    + '      <a href="' + rootBase + 'index.html" class="logo-link" aria-label="Home">'
    + '        <img src="' + rootBase + 'photo1.png" alt="AK Logo" />'
    + '      </a>'
    + '    </div>'
    + '    <div class="nav-right">'
    + '      <a href="' + pagesBase + 'aboutme.html" class="nav-link">About Me</a>'
    + '      <a href="' + pagesBase + 'contact.html" class="nav-link">Contact</a>'
    + '    </div>'
    + '  </nav>'
    + '</header>'
    + '<div class="sidebar-overlay" id="sidebarOverlay"></div>'
    + '<div class="mobile-sidebar" id="mobileSidebar">'
    + '  <div>'
    + '    <div class="sidebar-group-label">Projects</div>'
    + '    <div class="sidebar-sublinks">'
    + '      <a href="' + pagesBase + 'projects.html">Web App</a>'
    + '      <a href="' + pagesBase + 'projects-mobile.html">Mobile App</a>'
    + '    </div>'
    + '  </div>'
    + '  <div>'
    + '    <div class="sidebar-group-label">Labs</div>'
    + '    <div class="sidebar-sublinks">'
    + '      <a href="' + pagesBase + 'labs-code.html">Code</a>'
    + '      <a href="' + pagesBase + 'labs-visual.html">Visual Design</a>'
    + '    </div>'
    + '  </div>'
    + '  <a href="' + pagesBase + 'aboutme.html" class="sidebar-link">About Me</a>'
    + '  <a href="' + pagesBase + 'contact.html" class="sidebar-link">Contact</a>'
    + '</div>';

  document.write(style + navHTML);

  document.addEventListener('DOMContentLoaded', function () {
    // Footer uses the nav link's actual rendered color, even when a page styles the nav directly
    var firstNavLink = document.querySelector('.main-nav .nav-link');
    if (firstNavLink) {
      document.documentElement.style.setProperty('--footer-color', getComputedStyle(firstNavLink).color);
    }

    // Dropdown toggle for touch devices (desktop uses CSS :hover)
    var dropdownTriggers = document.querySelectorAll('.nav-item-with-dropdown');
    dropdownTriggers.forEach(function (trigger) {
      var navLink = trigger.querySelector('.nav-link');
      navLink.addEventListener('click', function (e) {
        if (window.matchMedia('(hover: none)').matches) {
          e.preventDefault();
          dropdownTriggers.forEach(function (other) {
            if (other !== trigger) other.classList.remove('active');
          });
          trigger.classList.toggle('active');
        }
      });
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav-item-with-dropdown')) {
        dropdownTriggers.forEach(function (trigger) { trigger.classList.remove('active'); });
      }
    });

    // Mobile sidebar toggle
    var hamburgerBtn = document.getElementById('hamburgerBtn');
    var mobileSidebar = document.getElementById('mobileSidebar');
    var sidebarOverlay = document.getElementById('sidebarOverlay');
    if (!hamburgerBtn || !mobileSidebar || !sidebarOverlay) return;

    function openSidebar() {
      hamburgerBtn.classList.add('active');
      mobileSidebar.classList.add('active');
      sidebarOverlay.classList.add('active');
    }
    function closeSidebar() {
      hamburgerBtn.classList.remove('active');
      mobileSidebar.classList.remove('active');
      sidebarOverlay.classList.remove('active');
    }
    hamburgerBtn.addEventListener('click', function () {
      mobileSidebar.classList.contains('active') ? closeSidebar() : openSidebar();
    });
    sidebarOverlay.addEventListener('click', closeSidebar);
    mobileSidebar.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeSidebar);
    });
  });
})();
