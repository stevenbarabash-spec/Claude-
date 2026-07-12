/* Global Base Media — shared site behavior */
(function () {
  "use strict";

  /* Mobile nav toggle */
  var toggle = document.querySelector(".nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.querySelectorAll(".nav-links a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* Tap-friendly Services dropdown (in addition to hover on desktop) */
  document.querySelectorAll(".dropdown > a").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (window.matchMedia("(hover: none)").matches || window.innerWidth <= 760) {
        var menu = a.parentElement.querySelector(".dropdown-menu");
        if (menu && !a.parentElement.classList.contains("open")) {
          e.preventDefault();
          a.parentElement.classList.add("open");
        }
      }
    });
  });

  /* Reveal-on-scroll (content is visible by default; .js gates the animation) */
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
      customers: document.getElementById("roi-customers"),
      yearly: document.getElementById("roi-yearly"),
    };
    var money = function (n) { return "$" + Math.round(n).toLocaleString("en-US"); };
    var update = function () {
      var L = +leads.value, C = +close.value, V = +value.value, M = +missed.value;
      out.leads.textContent = L;
      out.close.textContent = C + "%";
      out.value.textContent = money(V);
      out.missed.textContent = M + "%";
      // Customers currently lost to missed/slow-answered leads each month —
      // the ones an always-on system recaptures.
      var lostCustomers = L * (M / 100) * (C / 100);
      var lostRevenue = lostCustomers * V;
      out.customers.textContent = Math.round(lostCustomers);
      out.monthly.textContent = money(lostRevenue);
      out.yearly.textContent = money(lostRevenue * 12);
    };
    [leads, close, value, missed].forEach(function (el) { el.addEventListener("input", update); });
    update();
  }

  /* Contact form → LeadConnector inbound webhook (falls back to mailto) */
  var form = document.getElementById("contact-form");
  if (form) {
    var status = document.getElementById("form-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new FormData(form);
      var payload = {
        name: d.get("name"), business: d.get("business"), phone: d.get("phone"),
        email: d.get("email"), service: d.get("service"), message: d.get("message"),
        source: "globalbasemedia.com/contact",
        utm_source: sessionStorage.getItem("utm_source") || "",
        utm_medium: sessionStorage.getItem("utm_medium") || "",
        utm_campaign: sessionStorage.getItem("utm_campaign") || "",
      };
      var endpoint = form.getAttribute("data-webhook");
      var done = function (ok) {
        if (status) {
          status.hidden = false;
          status.textContent = ok
            ? "Thanks — we got it. A strategist will reach out shortly."
            : "Almost there — opening your email app to finish sending.";
          status.style.color = ok ? "var(--green)" : "var(--muted)";
        }
      };
      if (endpoint && /^https:\/\//.test(endpoint)) {
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(function (r) {
          if (!r.ok) throw new Error("bad status");
          form.reset();
          done(true);
        }).catch(mailtoFallback);
      } else {
        mailtoFallback();
      }
      function mailtoFallback() {
        done(false);
        var body =
          "Name: " + payload.name + "\nBusiness: " + payload.business +
          "\nPhone: " + payload.phone + "\nEmail: " + payload.email +
          "\nInterested in: " + payload.service + "\n\n" + payload.message;
        window.location.href =
          "mailto:hello@globalbasemedia.com?subject=" +
          encodeURIComponent("Website inquiry — " + payload.business) +
          "&body=" + encodeURIComponent(body);
      }
    });
  }

  /* Capture UTM params on landing so forms can attribute the lead */
  try {
    var qs = new URLSearchParams(window.location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(function (k) {
      if (qs.get(k)) sessionStorage.setItem(k, qs.get(k));
    });
  } catch (e) {}

  /* Current year in footer */
  document.querySelectorAll(".year").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
