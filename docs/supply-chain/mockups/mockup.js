// Mockup helpers: ?lang=ta|hi swaps text from data-ta / data-hi attributes; fills the bottom nav and desktop rail.
(function () {
  const lang = new URLSearchParams(location.search).get('lang') || 'en';
  document.documentElement.lang = lang;
  if (lang !== 'en') document.querySelectorAll('[data-' + lang + ']').forEach((el) => { el.innerHTML = el.getAttribute('data-' + lang); });
  const L = {
    en: { home: 'Home', chats: 'Chats', goods: 'Goods', orders: 'Orders', me: 'Profile' },
    ta: { home: 'முகப்பு', chats: 'சாட்', goods: 'சரக்கு', orders: 'ஆர்டர்', me: 'சுயவிவரம்' },
    hi: { home: 'होम', chats: 'चैट', goods: 'माल', orders: 'ऑर्डर', me: 'प्रोफ़ाइल' },
  }[lang] || {};
  const items = [['home', 'home'], ['chats', 'chats'], ['goods', 'package'], ['orders', 'orders'], ['me', 'user']];
  const ic = (id) => `<svg class="i" style="width:21px;height:21px"><use href="icons.svg#${id}"/></svg>`;
  document.querySelectorAll('nav.nav').forEach((nav) => {
    const on = nav.dataset.active, badge = nav.dataset.badge || {};
    nav.innerHTML = items.map(([k, icon]) => `<a href="#" class="${k === on ? 'on' : ''}"><span class="pill">${ic(icon)}${nav.dataset['badge' + k] ? `<span class="badge">${nav.dataset['badge' + k]}</span>` : ''}</span><span>${L[k]}</span></a>`).join('');
  });
  document.querySelectorAll('aside.rail').forEach((r) => {
    const on = r.dataset.active;
    r.innerHTML = `<div class="brand"><span class="cmark" style="width:30px;height:30px;font-size:13px">C</span>CLAIRE Connect</div>` +
      items.map(([k, icon]) => `<a href="#" class="${k === on ? 'on' : ''}">${ic(icon)}<span>${L[k]}</span></a>`).join('');
  });
})();
