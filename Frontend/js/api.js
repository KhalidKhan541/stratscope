(function () {
  var STRATSCOPE_API_BASE = "https://stratscope-api.khalidkhan.workers.dev";

  function request(path, options) {
    options = options || {};
    var headers = { "Accept": "application/json" };
    if (options.body) {
      headers["Content-Type"] = "application/json";
    }
    var controller = null;
    var timeoutId = null;
    if (typeof AbortController !== "undefined") {
      controller = new AbortController();
      timeoutId = setTimeout(function () {
        controller.abort();
      }, 6000);
    }
    var init = {
      method: options.method || "GET",
      headers: headers,
      signal: controller ? controller.signal : undefined
    };
    if (options.body) {
      init.body = options.body;
    }
    return fetch(STRATSCOPE_API_BASE + path, init)
      .then(function (res) {
        return res.json();
      })
      .catch(function () {
        return null;
      })
      .then(function (data) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (data === null) {
          return options.fallback;
        }
        return data;
      });
  }

  window.StratScopeAPI = {
    getStats: function () {
      return request("/v1/public/stats", {
        fallback: {
          agents: 0,
          executions: 0,
          datasets: 0,
          events: 0,
          benchmarks: 0,
          avg_cost_usd: 0,
          total_cost_usd: 0,
          success_rate: 0
        }
      }).then(function (data) {
        return data && data.data ? data.data : data;
      });
    },
    getExecutions: function (limit) {
      limit = limit || 10;
      return request("/v1/public/executions?limit=" + limit, { fallback: [] });
    },
    getEvents: function (limit) {
      limit = limit || 10;
      return request("/v1/public/events?limit=" + limit, { fallback: [] });
    },
    getAgents: function () {
      return request("/v1/public/agents", { fallback: [] });
    },
    getDatasets: function () {
      return request("/v1/public/datasets", { fallback: [] });
    },
    getBenchmarks: function () {
      return request("/v1/public/benchmarks", { fallback: [] });
    },
    registerAgent: function (payload) {
      return request("/v1/public/agents/register", {
        method: "POST",
        body: JSON.stringify(payload || {}),
        fallback: null
      });
    }
  };

  window.STRATSCOPE_FORMATTERS = {
    formatNumber: function (n) {
      n = Number(n) || 0;
      if (n >= 1000000) {
        return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1).replace(/\.0$/, "") + "M";
      }
      if (n >= 1000) {
        return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.0$/, "") + "K";
      }
      return String(n);
    },
    formatCost: function (n) {
      n = Number(n) || 0;
      if (n > 0.01) {
        return "$" + n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
      }
      return "$" + n.toFixed(4);
    },
    timeAgo: function (isoString) {
      if (!isoString) {
        return "just now";
      }
      var then = new Date(isoString).getTime();
      if (isNaN(then)) {
        return "just now";
      }
      var seconds = Math.floor((Date.now() - then) / 1000);
      if (seconds < 60) {
        return "just now";
      }
      var minutes = Math.floor(seconds / 60);
      if (minutes < 60) {
        return minutes + "m ago";
      }
      var hours = Math.floor(minutes / 60);
      if (hours < 24) {
        return hours + "h ago";
      }
      var days = Math.floor(hours / 24);
      if (days < 30) {
        return days + "d ago";
      }
      var months = Math.floor(days / 30);
      if (months < 12) {
        return months + "mo ago";
      }
      return Math.floor(months / 12) + "y ago";
    }
  };

  window.STRATSCOPE_API_BASE = STRATSCOPE_API_BASE;
})();
