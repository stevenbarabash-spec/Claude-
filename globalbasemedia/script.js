/* Global Base Media — shared site behavior */
(function () {
  "use strict";

  /* Mobile nav toggle */
  var toggle = document.querySelector(".nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      document.body.classList.toggle("nav-open");
      toggle.setAttribute(
        "aria-expanded",
        document.body.classList.contains("nav-open") ? "true" : "false"
      );
    });
    document.querySelectorAll(".nav-links a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("nav-open");
      });
    });
  }

  /* Reveal-on-scroll */
  var revealed = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealed.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealed.forEach(function (el) { io.observe(el); });
  } else {
    revealed.forEach(function (el) { el.classList.add("in"); });
  }

  /* ROI calculator (home page) */
  var leads = document.getElementById("roi-leads");
  if (leads) {
    var close = document.getElementById("roi-close");
    var value = document.getElementById("roi-value");
    var missed = document.getElementById("roi-missed");
    var out = {
      leads: document.getElementById("out-leads"),
      close: document.getElementById("out-close"),
      value: document.getElementById("out-value"),
      missed: document.getElementById("out-missed"),
      monthly: document.getElementById("roi-monthly"),
      yearly: document.getElementById("roi-yearly"),
    };
    var fmt = function (n) {
      return "$" + Math.round(n).toLocaleString("en-US");
    };
    var update = function () {
      var L = +leads.value, C = +close.value, V = +value.value, M = +missed.value;
      out.leads.textContent = L;
      out.close.textContent = C + "%";
      out.value.textContent = fmt(V);
      out.missed.textContent = M + "%";
      // Revenue currently lost to missed/unanswered leads each month
      var lost = L * (M / 100) * (C / 100) * V;
      out.monthly.textContent = fmt(lost);
      out.yearly.textContent = fmt(lost * 12) + "/yr";
    };
    [leads, close, value, missed].forEach(function (el) {
      el.addEventListener("input", update);
    });
    update();
  }

  /* Contact form → opens a pre-filled email (no backend required) */
  var form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new FormData(form);
      var body =
        "Name: " + d.get("name") + "\n" +
        "Business: " + d.get("business") + "\n" +
        "Phone: " + d.get("phone") + "\n" +
        "Email: " + d.get("email") + "\n" +
        "Interested in: " + d.get("service") + "\n\n" +
        d.get("message");
      window.location.href =
        "mailto:hello@globalbasemedia.com?subject=" +
        encodeURIComponent("Website inquiry — " + d.get("business")) +
        "&body=" + encodeURIComponent(body);
    });
  }

  /* Current year in footer */
  document.querySelectorAll(".year").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
