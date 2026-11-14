// Contact page: language (same storage key as the home page, Greek by default) and sending the form.
(function () {
  var KEY = 'athlomate-lang2';
  var html = document.documentElement;
  function getLang() {
    try { var v = localStorage.getItem(KEY); if (v === 'en' || v === 'el') return v; } catch (e) {}
    return 'el';
  }
  function setLang(l) {
    html.setAttribute('lang', l);
    try { localStorage.setItem(KEY, l); } catch (e) {}
    document.title = l === 'el' ? 'Επικοινωνία · Athlomate' : 'Contact · Athlomate';
    var btns = document.querySelectorAll('[data-setlang]');
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', btns[i].getAttribute('data-setlang') === l ? 'true' : 'false');
  }
  setLang(getLang());
  var sw = document.querySelectorAll('[data-setlang]');
  for (var i = 0; i < sw.length; i++) sw[i].addEventListener('click', function (e) { setLang(e.currentTarget.getAttribute('data-setlang')); });

  var form = document.getElementById('contact-form');
  if (!form) return;
  var opened = Date.now();
  var btn = document.getElementById('send-btn');
  var states = ['ok', 'err', 'invalid', 'busy'];
  function show(state) {
    for (var i = 0; i < states.length; i++) document.getElementById('st-' + states[i]).hidden = states[i] !== state;
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (btn.disabled) return;
    if (!form.checkValidity()) { show('invalid'); form.reportValidity(); return; }
    btn.disabled = true; show('busy');
    var body = {
      name: form.elements.name.value, email: form.elements.email.value, message: form.elements.message.value,
      website: form.elements.website.value, t: Date.now() - opened
    };
    fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, json: j }; }); })
      .then(function (r) {
        if (r.json && r.json.ok) { form.reset(); form.hidden = true; show('ok'); }
        else if (r.status === 400) { btn.disabled = false; show('invalid'); }
        else { btn.disabled = false; show('err'); }
      })
      .catch(function () { btn.disabled = false; show('err'); });
  });
})();
