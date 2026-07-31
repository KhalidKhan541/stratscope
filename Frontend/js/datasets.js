(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(value) {
    if (!value) {
      return "Unknown";
    }
    var d = new Date(value);
    if (isNaN(d.getTime())) {
      return "Unknown";
    }
    return d.toLocaleDateString();
  }

  function normalizeDatasets(data) {
    if (data && Array.isArray(data.data)) {
      return data.data;
    }
    if (data && Array.isArray(data.datasets)) {
      return data.datasets;
    }
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  }

  function pick(dataset, keys, fallback) {
    for (var i = 0; i < keys.length; i++) {
      if (dataset[keys[i]] != null) {
        return dataset[keys[i]];
      }
    }
    return fallback;
  }

  function cardHtml(dataset) {
    var category = pick(dataset, ["category", "type", "collection"], "Dataset");
    var name = pick(dataset, ["name", "title"], "Untitled dataset");
    var description = pick(dataset, ["description", "summary", "about"], "No description available.");
    var version = pick(dataset, ["version"], "n/a");
    var status = pick(dataset, ["status"], "active");
    var created = formatDate(pick(dataset, ["created_at", "createdAt", "created", "published_at", "publishedAt"], null));
    return '<div class="card"><span class="tag">' + esc(category) + '</span>' +
      '<h3 class="card-title">' + esc(name) + '</h3>' +
      '<p class="card-text">' + esc(description) + '</p>' +
      '<p class="card-text">Version ' + esc(version) + ' &bull; Status ' + esc(status) + ' &bull; Created ' + esc(created) + '</p></div>';
  }

  function findSection() {
    var sections = document.querySelectorAll(".section");
    for (var i = 0; i < sections.length; i++) {
      var head = sections[i].querySelector(".section-head");
      if (!head) {
        continue;
      }
      var title = head.querySelector(".section-title");
      if (title && /dataset/i.test(title.textContent || "")) {
        return sections[i];
      }
    }
    if (sections.length) {
      return sections[sections.length - 1];
    }
    return null;
  }

  ready(function () {
    try {
      if (!window.StratScopeAPI || !window.StratScopeAPI.getDatasets) {
        return;
      }
      window.StratScopeAPI.getDatasets().then(function (data) {
        try {
          var datasets = normalizeDatasets(data);
          if (!datasets.length) {
            return;
          }
          var section = findSection();
          if (!section) {
            return;
          }
          var cards = "";
          for (var i = 0; i < datasets.length; i++) {
            cards += cardHtml(datasets[i]);
          }
          var html = '<section class="section"><div class="container">' +
            '<div class="section-head center"><h2 class="section-title">Live datasets.</h2>' +
            '<p class="section-sub">Latest datasets straight from the StratScope execution corpus.</p></div>' +
            '<div class="grid-3">' + cards + '</div></div></section>';
          section.insertAdjacentHTML("afterend", html);
        } catch (e) {
          return;
        }
      });
    } catch (e) {
      return;
    }
  });
})();
