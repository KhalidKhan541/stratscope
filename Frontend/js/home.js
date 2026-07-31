(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function getFormatters() {
    var f = window.STRATSCOPE_FORMATTERS || (window.StratScopeAPI && window.StratScopeAPI.FORMATTERS) || {};
    return {
      formatNumber:
        f.formatNumber ||
        function (n) {
          n = Number(n) || 0;
          if (n >= 1000000) {
            return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
          }
          if (n >= 1000) {
            return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
          }
          return String(n);
        },
      timeAgo: f.timeAgo || null
    };
  }

  function timeAgo(ts) {
    var f = getFormatters();
    if (typeof f.timeAgo === "function") {
      return f.timeAgo(ts);
    }
    return "just now";
  }

  function scaled(value) {
    value = Number(value) || 0;
    if (value >= 1000000) {
      return { target: Math.round((value / 1000000) * 10) / 10, suffix: "M+", decimals: 1 };
    }
    if (value >= 1000) {
      return { target: Math.round((value / 1000) * 10) / 10, suffix: "K+", decimals: 1 };
    }
    return { target: value, suffix: "", decimals: 0 };
  }

  function setStatNumber(el, value, suffix, decimals) {
    value = Number(value) || 0;
    suffix = suffix || "";
    decimals = decimals === undefined ? (value % 1 === 0 ? 0 : 1) : decimals;
    el.setAttribute("data-target", value);
    el.setAttribute("data-suffix", suffix);
    el.setAttribute("data-decimals", decimals);
    el.textContent = value.toFixed(decimals) + suffix;
  }

  function applyStats(stats) {
    if (!stats || !(Number(stats.executions) > 0)) {
      return;
    }
    var els = document.querySelectorAll(".stat-number[data-target]");
    if (els.length < 4) {
      return;
    }
    var agents = scaled(stats.agents);
    var executions = scaled(stats.executions);
    setStatNumber(els[0], agents.target, agents.suffix, agents.decimals);
    setStatNumber(els[1], executions.target, executions.suffix, executions.decimals);
    var successRate = Number(stats.success_rate);
    if (successRate > 0) {
      setStatNumber(els[2], Math.round(successRate * 10) / 10, "%", 1);
    }
  }

  var FEED_STYLE =
    "<style>" +
    ".live-feed{max-width:780px;margin:24px auto 0;background:#16181d;border:1px solid #2a2d33;border-radius:12px;padding:18px 22px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-shadow:0 24px 60px rgba(0,0,0,0.18);}" +
    ".live-feed-head{display:flex;align-items:center;gap:10px;margin-bottom:14px;}" +
    ".live-feed-dot{width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 0 rgba(34,197,94,0.6);animation:livefeedpulse 1.8s infinite;flex:none;}" +
    "@keyframes livefeedpulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.5);}70%{box-shadow:0 0 0 7px rgba(34,197,94,0);}100%{box-shadow:0 0 0 0 rgba(34,197,94,0);}}" +
    ".live-feed-title{font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#9aa1a9;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif;}" +
    ".live-feed-list{list-style:none;margin:0;padding:0;}" +
    ".live-feed-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #23262c;font-size:12.5px;color:#c9cdd3;}" +
    ".live-feed-row:last-child{border-bottom:none;}" +
    ".live-feed-status{width:8px;height:8px;border-radius:50%;flex:none;}" +
    ".live-feed-status.ok{background:#22c55e;}" +
    ".live-feed-status.err{background:#ef4444;}" +
    ".live-feed-status.pending{background:#eab308;}" +
    ".live-feed-type{color:#8b949e;flex:none;}" +
    ".live-feed-id{color:#e8eaed;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}" +
    ".live-feed-time{color:#6b7280;flex:none;font-size:11.5px;}" +
    "</style>";

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function shortId(id) {
    id = String(id == null ? "" : id);
    if (id.length <= 16) {
      return id;
    }
    return id.slice(0, 8) + "\u2026" + id.slice(-6);
  }

  function eventType(ev) {
    return ev.event_type || ev.type || ev.eventType || ev.name || "";
  }

  function eventExecutionId(ev) {
    return (
      ev.execution_id ||
      ev.executionId ||
      ev.execution ||
      (ev.execution && ev.execution.id) ||
      ev.id ||
      ""
    );
  }

  function eventTimestamp(ev) {
    return (
      ev.created_at ||
      ev.createdAt ||
      ev.timestamp ||
      ev.time ||
      ev.completed_at ||
      ev.occurred_at ||
      ""
    );
  }

  function statusClass(type) {
    type = String(type || "").toLowerCase();
    if (type.indexOf("failure") !== -1 || type.indexOf("error") !== -1) {
      return "err";
    }
    if (type.indexOf("completed") !== -1) {
      return "ok";
    }
    return "pending";
  }

  function rowHtml(ev) {
    var type = eventType(ev);
    var id = eventExecutionId(ev);
    var ts = eventTimestamp(ev);
    return (
      '<li class="live-feed-row">' +
      '<span class="live-feed-status ' + statusClass(type) + '"></span>' +
      '<span class="live-feed-type">[' + escapeHtml(type || "event") + "]</span>" +
      '<span class="live-feed-id">' + escapeHtml(shortId(id)) + "</span>" +
      '<span class="live-feed-time">\u2022 ' + escapeHtml(timeAgo(ts)) + "</span>" +
      "</li>"
    );
  }

  function rowsHtml(events) {
    var rows = [];
    var max = Math.min(events.length, 12);
    var i;
    for (i = 0; i < max; i += 1) {
      rows.push(rowHtml(events[i]));
    }
    return rows.join("");
  }

  function feedHtml(events) {
    return (
      '<div class="live-feed">' +
      FEED_STYLE +
      '<div class="live-feed-head">' +
      '<span class="live-feed-dot"></span>' +
      '<h3 class="live-feed-title">Live SEEA execution stream</h3>' +
      "</div>" +
      '<ul class="live-feed-list">' +
      rowsHtml(events) +
      "</ul>" +
      "</div>"
    );
  }

  function executionToEvent(exec) {
    var outcome = String(exec.outcome || exec.status || "completed").toLowerCase();
    var ok = outcome.indexOf("fail") === -1 && outcome.indexOf("error") === -1;
    return {
      event_type: ok ? "execution.completed" : "execution.failed",
      execution_id: exec.id || exec.execution_id || exec.executionId || "",
      created_at: exec.completed_at || exec.created_at || exec.timestamp || ""
    };
  }

  function refreshFeed() {
    var api = window.StratScopeAPI;
    if (!api || !api.getEvents) {
      return;
    }
    api
      .getEvents(30)
      .then(function (events) {
        if (!events || !events.length) {
          return api.getExecutions(10).then(function (execs) {
            if (!execs || !execs.length) {
              return [];
            }
            var mapped = [];
            var i;
            for (i = 0; i < execs.length; i += 1) {
              mapped.push(executionToEvent(execs[i]));
            }
            return mapped;
          });
        }
        return events;
      })
      .then(function (events) {
        if (!events || !events.length) {
          return;
        }
        var hero = document.querySelector(".hero-panel");
        if (!hero) {
          return;
        }
        var feed = document.querySelector(".live-feed");
        if (!feed) {
          hero.insertAdjacentHTML("afterend", feedHtml(events));
          return;
        }
        var list = feed.querySelector(".live-feed-list");
        if (list) {
          list.innerHTML = rowsHtml(events);
        }
      });
  }

  function pollStats() {
    var api = window.StratScopeAPI;
    if (!api || !api.getStats) {
      return;
    }
    api.getStats().then(function (stats) {
      applyStats(stats);
    });
  }

  function pollFeed() {
    try {
      refreshFeed();
    } catch (e) {
      return;
    }
  }

  function pollStatsSafe() {
    try {
      pollStats();
    } catch (e) {
      return;
    }
  }

  ready(function () {
    try {
      if (!window.StratScopeAPI) {
        return;
      }
      pollStatsSafe();
      pollFeed();
      setInterval(pollFeed, 30000);
      setInterval(pollStatsSafe, 30000);
    } catch (e) {
      return;
    }
  });
})();
