/* Accessibility wiring: tablist/tabpanel relationships, arrow-key tab navigation, dialog label, figure labels, lazy search index. */
(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab-bar [data-target]'));
  tabs.forEach(function (b) {
    var id = 'tab-' + b.dataset.target, p = document.getElementById(b.dataset.target);
    b.setAttribute('role', 'tab'); b.id = id; b.setAttribute('aria-controls', b.dataset.target);
    if (!b.hasAttribute('aria-selected')) b.setAttribute('aria-selected', b.classList.contains('active') ? 'true' : 'false');
    if (p) { p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', id); }
  });
  function sync() { tabs.forEach(function (b) { var on = b.classList.contains('active'); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; }); }
  sync();
  new MutationObserver(sync).observe(document.querySelector('.tab-bar') || document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  document.addEventListener('keydown', function (e) {
    var cur = e.target.closest && e.target.closest('.tab-bar [role="tab"]');
    if (!cur || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End')) return;
    var i = tabs.indexOf(cur), n = tabs.length;
    var j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + n) % n;
    e.preventDefault(); tabs[j].focus();
  });
  var ov = document.getElementById('modalOverlay'), title = document.getElementById('modalTitle');
  var dlg = ov && ov.querySelector('[role="dialog"]') || ov;
  if (dlg && title) { if (!title.id) title.id = 'modalTitle'; dlg.setAttribute('aria-labelledby', title.id); dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); }
  var body = document.getElementById('modalBody');
  if (body) {
    var label = function () {
      body.querySelectorAll('.svg-chart:not([role])').forEach(function (f) {
        var l = f.querySelector('.svg-label,.ux-title,.vz-fig-title');
        f.setAttribute('role', 'figure'); if (l) f.setAttribute('aria-label', l.textContent.trim());
      });
    };
    new MutationObserver(label).observe(body, { childList: true, subtree: true });
  }
  document.addEventListener('focusin', function (e) { if (e.target && e.target.id === 'tileSearch' && window.__loadSearchIndex) window.__loadSearchIndex(); });
  document.addEventListener('input', function (e) { if (e.target && e.target.id === 'tileSearch' && window.__loadSearchIndex) window.__loadSearchIndex(); });
})();
