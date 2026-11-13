// Homepage motion (index.html only). Everything here is optional polish and respects prefers-reduced-motion.
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var nav = document.querySelector(".nav");
  var wall = document.querySelector(".wall");
  var doc = document.documentElement;

  var bar = document.createElement("div");
  bar.className = "progress";
  document.body.appendChild(bar);

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var max = doc.scrollHeight - doc.clientHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? doc.scrollTop / max : 0) + ")";
      nav.classList.toggle("scrolled", doc.scrollTop > 10);
      // The photo tiles start as an arc and line up with the phone while you scroll past them.
      if (wall && !reduce) {
        var r = wall.getBoundingClientRect();
        var p = (window.innerHeight - r.top) / (window.innerHeight * 0.9);
        wall.style.setProperty("--p", Math.max(0, Math.min(1, p - 0.25)).toFixed(3));
      }
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  // Rotating example games in the notification on the phone
  var tick = document.getElementById("tick");
  var msgs = {
    en: ["Football · tonight 20:30 · 2 spots left", "Padel · Sat 11:00 · players needed", "Running · Sun 09:00 · all levels"],
    el: ["Ποδόσφαιρο · απόψε 20:30 · 2 θέσεις", "Πάντελ · Σάβ 11:00 · ψάχνουμε παίκτες", "Τρέξιμο · Κυρ 09:00 · όλα τα επίπεδα"]
  };
  if (tick) {
    var k = 0;
    var show = function (animate) {
      var list = msgs[doc.lang === "el" ? "el" : "en"];
      tick.textContent = list[k % list.length];
      if (!animate) return;
      tick.classList.remove("swap");
      void tick.offsetWidth;
      tick.classList.add("swap");
    };
    show(false);
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.addEventListener("click", function () { setTimeout(function () { show(false); }, 0); });
    });
    // script.js sets the language after this file runs
    window.addEventListener("DOMContentLoaded", function () { show(false); });
    if (!reduce) setInterval(function () { k += 1; show(true); }, 3200);
  }

  if (reduce || !("IntersectionObserver" in window)) return;

  // Scroll reveal. Game rows are rendered by script.js, so wait for the page to be ready.
  function reveal() {
    var els = [].slice.call(document.querySelectorAll(".sec-head, .card, .fx, .split > *, .cta, .hero-stats"));
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.classList.add("in");
        io.unobserve(el);
        setTimeout(function () { el.classList.remove("rv", "in"); el.style.removeProperty("--rd"); }, 1300);
      });
    }, { threshold: 0.1 });
    els.forEach(function (el) {
      var idx = [].indexOf.call(el.parentNode.children, el);
      el.classList.add("rv");
      el.style.setProperty("--rd", (el.classList.contains("fx") ? (idx % 5) * 60 : Math.min(idx, 4) * 80) + "ms");
      io.observe(el);
    });
  }
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", reveal); else reveal();

  // Count-up for the first hero stat
  var stat = document.querySelector(".hero-stats strong");
  if (stat && /^\d+\+$/.test(stat.textContent.trim())) {
    var target = parseInt(stat.textContent, 10), n = 0, started = false;
    stat.textContent = "0+";
    new IntersectionObserver(function (es, o) {
      if (!es[0].isIntersecting || started) return;
      started = true; o.disconnect();
      var iv = setInterval(function () { n += 1; stat.textContent = n + "+"; if (n >= target) clearInterval(iv); }, 70);
    }, { threshold: 0.6 }).observe(stat);
  }
})();
