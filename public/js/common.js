/* Общий скрипт всех страниц: Яндекс Метрика (цели), счётчик «забрали бонус», уведомление о cookie */
(function () {
  "use strict";
  var YM_ID = 113247286;

  /* Цель в Метрике. cb вызывается после отправки (или через 0,8 с, если Метрика заблокирована) */
  function goal(name, params, cb) {
    var done = false;
    function fin() { if (!done) { done = true; if (cb) cb(); } }
    try { ym(YM_ID, "reachGoal", name, params || {}, fin); } catch (_) { fin(); return; }
    if (cb) setTimeout(fin, 800);
  }
  /* Виртуальный просмотр страницы (шаги входа) */
  function hit(path, title) {
    try { ym(YM_ID, "hit", location.origin + path, { title: title }); } catch (_) {}
  }

  /* Счётчик «забрали бонус»: один человек = +1 на карточку (в этом браузере) */
  var CLAIM_KEY = "bonusClaimedByMe";
  var myClaims = {};
  try { myClaims = JSON.parse(localStorage.getItem(CLAIM_KEY) || "{}") || {}; } catch (_) { myClaims = {}; }
  var BR = window.BR = { goal: goal, hit: hit, myClaims: myClaims, onClaim: null };

  function claim(name) {
    if (myClaims[name]) return;
    myClaims[name] = true;
    try { localStorage.setItem(CLAIM_KEY, JSON.stringify(myClaims)); } catch (_) {}
    if (BR.onClaim) BR.onClaim();
  }

  /* Кнопка «Забрать фрибет» — на главной и на страницах акций */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest(".cta[data-name]");
    if (!a) return;
    goal("claim_click", { offer: a.dataset.name });
    if (a.dataset.goal) goal("claim_" + a.dataset.goal);
    claim(a.dataset.name);
  }, true);

  /* Уведомление о cookie (Метрика работает сразу, уведомление информационное) */
  var box = null;
  BR.showCookie = function () {
    var seen = null;
    try { seen = localStorage.getItem("cookieNoticeSeen"); } catch (_) {}
    if (seen) return;
    if (!box) {
      box = document.createElement("div");
      box.className = "cookie";
      box.setAttribute("role", "region");
      box.setAttribute("aria-label", "Уведомление об использовании cookie");
      box.innerHTML = '<p>Мы используем файлы cookie и сервис «Яндекс Метрика» для статистики посещаемости. ' +
        'Продолжая пользоваться сайтом, вы соглашаетесь с их использованием. ' +
        'Подробнее в <a href="/privacy/">Политике конфиденциальности</a>.</p>' +
        '<button type="button" class="cookie-ok">Понятно</button>';
      box.querySelector("button").addEventListener("click", function () {
        box.hidden = true;
        try { localStorage.setItem("cookieNoticeSeen", "1"); } catch (_) {}
      });
      document.body.appendChild(box);
    }
    box.hidden = false;
  };
  if (document.body.dataset.cookie === "auto") BR.showCookie();
})();
