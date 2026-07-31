(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function each(list, fn) {
    Array.prototype.forEach.call(list, fn);
  }

  ready(function () {
    var navbar = document.getElementById("navbar");
    if (navbar) {
      window.addEventListener("scroll", function () {
        if (window.scrollY > 8) {
          navbar.classList.add("scrolled");
        } else {
          navbar.classList.remove("scrolled");
        }
      });
    }

    var menuToggle = document.getElementById("menuToggle");
    var navLinks = document.getElementById("navLinks");
    if (menuToggle && navLinks) {
      menuToggle.addEventListener("click", function () {
        navLinks.classList.toggle("open");
      });
      navLinks.addEventListener("click", function (e) {
        if (e.target && e.target.tagName === "A") {
          navLinks.classList.remove("open");
        }
      });
    }

    var revealEls = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window) {
      var revealObserver = new IntersectionObserver(
        function (entries) {
          each(entries, function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15 }
      );
      each(revealEls, function (el) {
        revealObserver.observe(el);
      });
    } else {
      each(revealEls, function (el) {
        el.classList.add("visible");
      });
    }

    var statNumbers = document.querySelectorAll(".stat-number[data-target]");
    if (statNumbers.length && "IntersectionObserver" in window) {
      var counterObserver = new IntersectionObserver(
        function (entries) {
          each(entries, function (entry) {
            if (entry.isIntersecting) {
              animateCounter(entry.target);
              counterObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15 }
      );
      each(statNumbers, function (el) {
        counterObserver.observe(el);
      });
    } else {
      each(statNumbers, function (el) {
        el.textContent = formatStat(el, parseFloat(el.getAttribute("data-target")) || 0);
      });
    }

    function animateCounter(el) {
      var target = parseFloat(el.getAttribute("data-target")) || 0;
      var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
      var suffix = el.getAttribute("data-suffix") || "";
      var duration = 1400;
      var startTime = null;

      function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
      }

      function step(timestamp) {
        if (startTime === null) {
          startTime = timestamp;
        }
        var progress = Math.min((timestamp - startTime) / duration, 1);
        el.textContent = (target * easeOutCubic(progress)).toFixed(decimals) + suffix;
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      }

      window.requestAnimationFrame(step);
    }

    function formatStat(el, value) {
      var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
      var suffix = el.getAttribute("data-suffix") || "";
      return value.toFixed(decimals) + suffix;
    }

    var faqItems = document.querySelectorAll(".faq-item");
    each(faqItems, function (item) {
      var question = item.querySelector(".faq-q");
      if (!question) {
        return;
      }
      question.addEventListener("click", function () {
        var wasOpen = item.classList.contains("open");
        var container = item.parentElement;
        if (container) {
          each(container.children, function (child) {
            if (child !== item && child.classList.contains("faq-item")) {
              child.classList.remove("open");
            }
          });
        }
        if (!wasOpen) {
          item.classList.add("open");
        } else {
          item.classList.remove("open");
        }
      });
    });

    var yearEl = document.getElementById("year");
    if (yearEl) {
      yearEl.textContent = String(new Date().getFullYear());
    }
  });
})();
