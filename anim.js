(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canHover = window.matchMedia("(hover: hover)").matches;
  var nav = document.querySelector(".nav");
  var hero = document.querySelector(".hero");

  // Scroll progress bar and nav shadow
  var bar = document.createElement("div");
  bar.className = "progress";
  document.body.appendChild(bar);
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? h.scrollTop / max : 0) + ")";
      nav.classList.toggle("scrolled", h.scrollTop > 10);
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (reduce) return;

  // Glow orbs in the hero
  if (hero) {
    ["o1", "o2"].forEach(function (c) {
      var o = document.createElement("span");
      o.className = "orb " + c;
      o.setAttribute("aria-hidden", "true");
      hero.appendChild(o);
    });
  }

  // Scroll reveal
  if ("IntersectionObserver" in window) {
    var sel = ".hero-inner > *, .sec-head, .card, .showcase > *, .split > *, .faq details, .cta, .game";
    var els = [].slice.call(document.querySelectorAll(sel));
    els.forEach(function (el) {
      var idx = [].indexOf.call(el.parentNode.children, el);
      el.classList.add("reveal");
      el.style.setProperty("--d", Math.min(idx, 6) * 90 + "ms");
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.classList.add("in");
        io.unobserve(el);
        setTimeout(function () {
          el.classList.remove("reveal", "in");
          el.style.removeProperty("--d");
        }, 1600);
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  // Count-up for the first hero stat
  var stat = document.querySelector(".hero-stats strong");
  if (stat && /^\d+\+$/.test(stat.textContent.trim())) {
    var target = parseInt(stat.textContent, 10), n = 0;
    stat.textContent = "0+";
    setTimeout(function () {
      var iv = setInterval(function () {
        n += 1;
        stat.textContent = n + "+";
        if (n >= target) clearInterval(iv);
      }, 110);
    }, 500);
  }

  // Rotating example games in the floating chip
  var tick = document.getElementById("tick");
  var msgs = {
    en: ["Football \u00b7 tonight 20:30 \u00b7 2 spots left", "Padel \u00b7 Sat 11:00 \u00b7 players needed", "Running \u00b7 Sun 09:00 \u00b7 all levels"],
    el: ["\u03a0\u03bf\u03b4\u03cc\u03c3\u03c6\u03b1\u03b9\u03c1\u03bf \u00b7 \u03b1\u03c0\u03cc\u03c8\u03b5 20:30 \u00b7 2 \u03b8\u03ad\u03c3\u03b5\u03b9\u03c2", "\u03a0\u03ac\u03bd\u03c4\u03b5\u03bb \u00b7 \u03a3\u03ac\u03b2 11:00 \u00b7 \u03c8\u03ac\u03c7\u03bd\u03bf\u03c5\u03bc\u03b5 \u03c0\u03b1\u03af\u03ba\u03c4\u03b5\u03c2", "\u03a4\u03c1\u03ad\u03be\u03b9\u03bc\u03bf \u00b7 \u039a\u03c5\u03c1 09:00 \u00b7 \u03cc\u03bb\u03b1 \u03c4\u03b1 \u03b5\u03c0\u03af\u03c0\u03b5\u03b4\u03b1"]
  };
  if (tick) {
    var k = 0;
    function show() {
      var list = msgs[document.documentElement.lang === "el" ? "el" : "en"];
      tick.textContent = list[k % list.length];
      tick.classList.remove("swap");
      void tick.offsetWidth;
      tick.classList.add("swap");
    }
    show();
    setInterval(function () { k += 1; show(); }, 3000);
  }

  if (!canHover) return;

  // Spotlight on cards
  document.querySelectorAll(".card").forEach(function (c) {
    c.addEventListener("mousemove", function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty("--mx", e.clientX - r.left + "px");
      c.style.setProperty("--my", e.clientY - r.top + "px");
    });
  });

  // Gentle tilt on the hero phone and the showcase phone
  document.querySelectorAll(".hero-shot img, .showcase .phone").forEach(function (el) {
    el.addEventListener("mousemove", function (e) {
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = "perspective(1000px) rotateY(" + x * 8 + "deg) rotateX(" + -y * 8 + "deg)";
    });
    el.addEventListener("mouseleave", function () { el.style.transform = ""; });
  });
})();
