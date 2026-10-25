/* FitSquad Mockup 交互辅助（可选，纯原生 JS，无依赖）
 * data-toast="文案"            点击后在所在 .phone 内弹出 toast
 * data-toggle                  点击切换自身 .is-on（勾选框 / 开关）
 * data-group="名称"            同组内单选，切换 .is-selected（chip / option / seg 用 .is-active）
 * data-set-state="值" data-target="#id"
 *                              切换目标容器状态：目标内 [data-when="值1 值2"] 只在匹配时显示
 */
(function () {
  function toast(phone, text) {
    if (!phone) return;
    var el = phone.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; phone.appendChild(el); }
    el.textContent = text;
    el.classList.add('is-show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('is-show'); }, 1600);
  }

  function applyState(target, state) {
    target.setAttribute('data-state', state);
    target.querySelectorAll('[data-when]').forEach(function (el) {
      el.classList.toggle('is-hidden', el.getAttribute('data-when').split(' ').indexOf(state) === -1);
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-toast]');
    if (t) { e.preventDefault(); toast(t.closest('.phone'), t.getAttribute('data-toast')); }

    var tg = e.target.closest('[data-toggle]');
    if (tg) tg.classList.toggle('is-on');

    var g = e.target.closest('[data-group]');
    if (g) {
      var name = g.getAttribute('data-group');
      var cls = g.classList.contains('seg') ? 'is-active' : 'is-selected';
      document.querySelectorAll('[data-group="' + name + '"]').forEach(function (el) { el.classList.remove(cls); });
      g.classList.add(cls);
    }

    var s = e.target.closest('[data-set-state]');
    if (s) {
      var target = document.querySelector(s.getAttribute('data-target'));
      if (target) applyState(target, s.getAttribute('data-set-state'));
      var sw = s.closest('.mk-switch');
      if (sw) sw.querySelectorAll('button').forEach(function (b) { b.classList.toggle('is-active', b === s); });
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-state]').forEach(function (el) { applyState(el, el.getAttribute('data-state')); });
  });
})();
