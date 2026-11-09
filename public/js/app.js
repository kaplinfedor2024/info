/* Главная страница: фильтры, окна входа, правила получения */
(function () {
  "use strict";
  var BR = window.BR;
  var goal = BR.goal, hit = BR.hit;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  var grid = $("#offers");
  var cards = $$(".card", grid);
  var emptyBox = $("#empty");
  var activeTag = "все";
  var mode = null;                 // null | "new" | "pro"
  var owned = {};                  // букмекеры, где у посетителя уже есть аккаунт: { "Фонбет": true }
  var hideOwned = true;

  cards.forEach(function (c) {
    c._name = c.dataset.name;
    c._end = +c.dataset.end;
    c._tags = c.dataset.tags.split("|");
  });

  function plural(n, one, few, many) {
    var m = Math.abs(n) % 100, d = m % 10;
    if (m > 10 && m < 20) return many;
    if (d > 1 && d < 5) return few;
    return d === 1 ? one : many;
  }
  function fmtLeft(ms) {
    if (ms <= 0) return null;
    var d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
    if (d === 0) return "Действует ещё " + h + " " + plural(h, "час", "часа", "часов");
    return "Действует ещё " + d + " " + plural(d, "день", "дня", "дней") + " и " + h + " " + plural(h, "час", "часа", "часов");
  }
  function fmtNum(n) { return n.toLocaleString("ru-RU"); }
  function ownedCount() { return Object.keys(owned).length; }
  function countOf(c) { return (+c.dataset.claimed || 0) + (BR.myClaims[c._name] ? 1 : 0); }

  function updateCounts() {
    var total = 0;
    cards.forEach(function (c) {
      var n = countOf(c); total += n;
      $("[data-count]", c).textContent = fmtNum(n);
    });
    $("#totalCount").textContent = fmtNum(total);
  }
  BR.onClaim = updateCounts;

  function render() {
    var now = Date.now(), shown = 0;
    cards.forEach(function (c) {
      var live = c._end > now;
      var vis = live && (activeTag === "все" || c._tags.indexOf(activeTag) > -1) &&
        !(mode === "pro" && hideOwned && owned[c._name]);
      c.hidden = !vis;
      if (vis) shown++;
      $(".own", c).hidden = !(mode === "pro" && owned[c._name]);
      var t = fmtLeft(c._end - now);
      if (t) $(".left span", c).textContent = t;
    });
    if (!shown) {
      var allOwned = mode === "pro" && hideOwned && ownedCount();
      emptyBox.textContent = (allOwned && activeTag === "все")
        ? "Ты уже играешь у всех наших букмекеров. Сними галочку выше, чтобы увидеть все бонусы, или загляни позже."
        : "Пока нет подходящих предложений.";
    }
    emptyBox.hidden = shown > 0;
    updateCounts();
  }

  /* ----- Фильтры ----- */
  $("#filters").addEventListener("click", function (e) {
    var b = e.target.closest(".chip");
    if (!b) return;
    activeTag = b.dataset.tag;
    $$(".chip").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
    goal("filter_tag", { tag: activeTag });
    render();
  });

  /* ----- Правила получения (окно; без JS это обычная ссылка на страницу акции) ----- */
  var modal = $("#rulesModal"), rulesBody = $("#rulesBody"), rulesName = $("#rulesName");
  var rulesOffer = "", rulesCache = {};
  function showRules(html) { rulesBody.innerHTML = html; rulesBody.scrollTop = 0; }
  grid.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-rules]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    var card = a.closest(".card");
    rulesOffer = card._name;
    goal("rules_open", { offer: rulesOffer });
    rulesName.textContent = card._name + " · " + $(".amount", card).textContent;
    showRules("<p>Загружаем правила…</p>");
    document.body.classList.add("lock");
    modal.showModal();
    var url = a.getAttribute("href");
    if (rulesCache[url]) { showRules(rulesCache[url]); return; }
    fetch(url).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (txt) {
      var el = new DOMParser().parseFromString(txt, "text/html").getElementById("rules");
      if (!el) throw 0;
      // на странице акции заголовки H2/H3, в окне — H3/H4
      var h = el.innerHTML.replace(/<(\/?)h3/g, "<$1h4").replace(/<(\/?)h2/g, "<$1h3");
      rulesCache[url] = h; showRules(h);
    }).catch(function () {
      showRules('<p>Не удалось загрузить правила. <a href="' + url + '">Открыть страницу акции</a></p>');
    });
  });
  function closeRules() { modal.close(); }
  modal.addEventListener("close", function () { document.body.classList.remove("lock"); });
  $("#rulesX").addEventListener("click", closeRules);
  $("#rulesOk").addEventListener("click", function () { goal("rules_ok", { offer: rulesOffer }); closeRules(); });
  modal.addEventListener("click", function (e) { if (e.target === modal) closeRules(); });

  /* ----- Окна входа: возраст → опыт → выбор букмекеров ----- */
  var ageGate = $("#ageGate"), expGate = $("#expGate"), ownGate = $("#ownGate"), newGate = $("#newGate");
  var EXIT_URL = "https://yandex.ru";                 // куда отправляем тех, кому нет 18
  var STEP_HITS = { expGate: ["/step/experience", "Шаг: опыт"], ownGate: ["/step/own", "Шаг: выбор букмекеров"], newGate: ["/step/newbie", "Шаг: первый бонус"] };
  [ageGate, expGate, ownGate, newGate].forEach(function (d) {
    d.addEventListener("cancel", function (e) { e.preventDefault(); });                 // Esc не закрывает окно
    d.addEventListener("close", function () { if (!d.dataset.ok && !d.open) d.showModal(); });
  });
  function openGate(d) {
    if (STEP_HITS[d.id]) hit(STEP_HITS[d.id][0], STEP_HITS[d.id][1]);
    delete d.dataset.ok;
    if (!d.open) d.showModal();
    d.focus();
    document.body.classList.add("lock");
  }
  function closeGate(d) { d.dataset.ok = "1"; d.close(); }
  function finishGates() { document.body.classList.remove("lock"); window.scrollTo(0, 0); BR.showCookie(); }

  /* Плитки с логотипами */
  var pickGrid = $("#pickGrid");
  pickGrid.innerHTML = cards.map(function (c) {
    var n = c._name.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    return '<label class="pick"><input type="checkbox" value="' + n + '"><span class="pick-box"><img src="' +
      $(".brand img", c).getAttribute("src") + '" alt=""><span class="pick-name">' + n + "</span></span></label>";
  }).join("");
  function syncPicks() { $$("input", pickGrid).forEach(function (i) { i.checked = !!owned[i.value]; }); }
  function pickedNames() { return $$("input:checked", pickGrid).map(function (i) { return i.value; }); }
  var ownFromPage = false;
  function openOwn(fromPage) {
    ownFromPage = fromPage;
    $("#ownBack").textContent = fromPage ? "Отмена" : "Назад";
    syncPicks();
    openGate(ownGate);
  }

  /* Режимы страницы: "new" — новичок, "pro" — опытный */
  var heroKicker = $("#heroKicker"), heroText = $("#heroText"), hideBox = $("#hideOwned");
  var DEFAULT_TEXT = heroText.textContent;
  var PRO_TITLE = "Где у тебя ещё нет аккаунта?";
  var PRO_TEXT = "Ты уже знаешь, как это работает, поэтому коротко. У каждого букмекера приветственный бонус выдаётся один раз, и в тех, где ты не регистрировался, он тебя ждёт. Сравни условия на карточках: сумма, срок, правила получения. Если профиль в Едином ЦУПИС подтверждён, регистрация займёт пару минут.";
  function updateProNote() {
    var now = Date.now();
    var free = cards.filter(function (c) { return c._end > now && !owned[c._name]; }).length;
    var note = $("#proNote");
    if (!ownedCount()) note.textContent = "Ты не отметил ни одного букмекера, поэтому показываем все бонусы.";
    else if (!free) note.textContent = "Ты уже играешь у всех наших букмекеров. Загляни позже, мы добавим новые.";
    else note.textContent = "У тебя " + free + " " + plural(free, "бонус", "бонуса", "бонусов") + " у букмекеров, где ещё нет аккаунта";
    hideBox.disabled = !ownedCount();
  }
  function applyMode() {
    $("#proBox").hidden = mode !== "pro";
    heroKicker.hidden = mode !== "pro";
    heroKicker.textContent = PRO_TITLE;
    heroText.textContent = mode === "pro" ? PRO_TEXT : DEFAULT_TEXT;
    if (mode === "pro") updateProNote();
    hit("/list/" + (mode || "all"), "Список бонусов: " + (mode === "pro" ? "опытный" : "новичок"));
    render();
  }

  $("#ageNo").addEventListener("click", function () { goal("age_no", {}, function () { location.replace(EXIT_URL); }); });
  $("#ageYes").addEventListener("click", function () { goal("age_yes"); closeGate(ageGate); openGate(expGate); });
  $("#expYes").addEventListener("click", function () { goal("exp_yes"); closeGate(expGate); openOwn(false); });
  $("#expNo").addEventListener("click", function () {
    goal("exp_no");
    mode = "new"; owned = {}; closeGate(expGate); openGate(newGate);
  });
  $("#ownBack").addEventListener("click", function () {
    closeGate(ownGate);
    if (ownFromPage) finishGates(); else openGate(expGate);
  });
  $("#ownGo").addEventListener("click", function () {
    var names = pickedNames();
    goal("own_go", { owned: names.join(", ") || "нет" });
    owned = {}; names.forEach(function (n) { owned[n] = true; });
    mode = "pro"; hideOwned = true; hideBox.checked = true;
    closeGate(ownGate); finishGates(); applyMode();
  });
  $("#newBack").addEventListener("click", function () { closeGate(newGate); openGate(expGate); });
  $("#newGo").addEventListener("click", function () {
    goal("new_go");
    closeGate(newGate); finishGates(); applyMode();
    $("#offers").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  hideBox.addEventListener("change", function () {
    hideOwned = hideBox.checked;
    goal("hide_owned_toggle", { state: hideBox.checked ? "on" : "off" });
    render();
  });
  $("#editOwned").addEventListener("click", function () { goal("edit_owned"); openOwn(true); });
  $$(".js-change-answer").forEach(function (b) {
    b.addEventListener("click", function () { goal("change_answer"); openGate(expGate); });
  });

  render();
  setInterval(render, 60000);
  openGate(ageGate);
})();
