(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[ch];
    });
  }

  function normalizeBenchmarks(data) {
    if (data && typeof data === "object" && !Array.isArray(data) && Array.isArray(data.data)) {
      return data.data;
    }
    return Array.isArray(data) ? data : [];
  }

  function buildCard(benchmark) {
    var name = escapeHtml(benchmark.name);
    var description = escapeHtml(benchmark.description);
    var category = escapeHtml(benchmark.category);
    var status = escapeHtml(benchmark.status);
    return (
      '<div class="card">' +
      '<span class="tag">' + category + "</span>" +
      '<h3 class="card-title">' + name + "</h3>" +
      '<p class="card-text">' + description + "</p>" +
      '<p class="card-text">Status: ' + status + "</p>" +
      "</div>"
    );
  }

  function renderBenchmarks(benchmarks) {
    var sections = document.querySelectorAll(".section");
    if (!sections.length) {
      return;
    }
    var lastSection = sections[sections.length - 1];
    var cardsHtml = "";
    for (var i = 0; i < benchmarks.length; i++) {
      cardsHtml += buildCard(benchmarks[i]);
    }
    var sectionHtml =
      '<section class="section">' +
      '<div class="container">' +
      '<div class="section-head center">' +
      '<h2 class="section-title">Live benchmarks from the platform</h2>' +
      "</div>" +
      '<div class="grid-3">' +
      cardsHtml +
      "</div>" +
      "</div>" +
      "</section>";
    lastSection.insertAdjacentHTML("afterend", sectionHtml);
  }

  ready(function () {
    try {
      if (!window.StratScopeAPI || typeof window.StratScopeAPI.getBenchmarks !== "function") {
        return;
      }
      window.StratScopeAPI.getBenchmarks().then(function (data) {
        try {
          var benchmarks = normalizeBenchmarks(data);
          if (benchmarks.length > 0) {
            renderBenchmarks(benchmarks);
          }
        } catch (err) {
          return;
        }
      });
    } catch (err) {
      return;
    }
  });
})();
