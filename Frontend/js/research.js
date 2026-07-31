(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function esc(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pick(obj, keys, fallback) {
    for (var i = 0; i < keys.length; i++) {
      if (obj[keys[i]] !== undefined && obj[keys[i]] !== null) {
        return obj[keys[i]];
      }
    }
    return fallback;
  }

  function toList(data) {
    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray(data.data)) {
      return data.data;
    }
    return [];
  }

  function numberValue(value) {
    var n = Number(value);
    return isNaN(n) ? 0 : n;
  }

  ready(function () {
    var api = window.StratScopeAPI;
    if (!api || !api.getExecutions || !api.getEvents) {
      return;
    }

    Promise.all([api.getExecutions(50), api.getEvents(100)]).then(function (results) {
      var executions = toList(results[0]);
      if (!executions.length) {
        return;
      }

      var formatters = window.StratScopeAPI.FORMATTERS || window.STRATSCOPE_FORMATTERS || null;
      var num = formatters && formatters.formatNumber
        ? formatters.formatNumber
        : function (n) { return String(n); };
      var money = formatters && formatters.formatCost
        ? formatters.formatCost
        : function (n) { return "$" + n.toFixed(4); };

      var total = executions.length;
      var completed = 0;
      var costSum = 0;
      var latencySum = 0;

      for (var i = 0; i < total; i++) {
        var ex = executions[i];
        var status = String(pick(ex, ["status", "state", "outcome"], "")).toLowerCase();
        if (status === "completed" || status === "success" || status === "ok") {
          completed++;
        }
        costSum += numberValue(pick(ex, ["cost_usd", "cost"], 0));
        latencySum += numberValue(pick(ex, ["latency_ms", "duration_ms", "latency"], 0));
      }

      var successRate = total ? (completed / total) * 100 : 0;
      var avgCost = total ? costSum / total : 0;
      var avgLatency = total ? latencySum / total : 0;

      var recent = executions.slice(0);
      recent.sort(function (a, b) {
        var ta = new Date(pick(a, ["created_at", "timestamp", "createdAt", "started_at", "time", "date"], 0)).getTime();
        var tb = new Date(pick(b, ["created_at", "timestamp", "createdAt", "started_at", "time", "date"], 0)).getTime();
        if (isNaN(ta)) { ta = 0; }
        if (isNaN(tb)) { tb = 0; }
        return tb - ta;
      });
      recent = recent.slice(0, 10);

      function statusStyle(status) {
        status = String(status).toLowerCase();
        if (status === "completed" || status === "success" || status === "ok") {
          return "#0a7d33";
        }
        if (status === "failed" || status === "error" || status === "failure") {
          return "#c0392b";
        }
        return "#8a8f98";
      }

      function timeText(ex) {
        var ts = pick(ex, ["created_at", "timestamp", "createdAt", "started_at", "time", "date"], "");
        if (!ts) {
          return "\u2014";
        }
        if (formatters && formatters.timeAgo) {
          return formatters.timeAgo(ts);
        }
        var d = new Date(ts);
        return isNaN(d.getTime()) ? "\u2014" : d.toLocaleString();
      }

      function cardHtml(tagText, value, label) {
        return '<div class="card">' +
          '<span class="tag">' + esc(tagText) + '</span>' +
          '<h3 class="card-title" style="font-size:26px;margin:0 0 4px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:-0.02em;">' + esc(value) + '</h3>' +
          '<p class="card-text">' + esc(label) + '</p>' +
          '</div>';
      }

      var rows = "";
      for (var j = 0; j < recent.length; j++) {
        var r = recent[j];
        var st = pick(r, ["status", "state", "outcome"], "unknown");
        var model = pick(r, ["model", "model_name", "model_id"], "\u2014");
        var lat = pick(r, ["latency_ms", "duration_ms", "latency"], null);
        var cost = pick(r, ["cost_usd", "cost"], null);
        var latText = lat === null ? "\u2014" : Math.round(numberValue(lat)) + " ms";
        var costText = cost === null ? "\u2014" : money(numberValue(cost));
        rows += '<tr>' +
          '<td style="color:' + statusStyle(st) + ';font-weight:600;">' + esc(st) + '</td>' +
          '<td>' + esc(model) + '</td>' +
          '<td>' + esc(latText) + '</td>' +
          '<td>' + esc(costText) + '</td>' +
          '<td>' + esc(timeText(r)) + '</td>' +
          '</tr>';
      }

      var eventsCount = toList(results[1]).length;
      var sub = "Computed live from " + num(total) + " executions in the corpus" + (eventsCount ? " and " + num(eventsCount) + " events" : "") + ".";

      var html =
        '<section class="section">' +
        '<div class="container">' +
        '<div class="section-head center">' +
        '<h2 class="section-title">Live platform analytics</h2>' +
        '<p class="section-sub">' + esc(sub) + '</p>' +
        '</div>' +
        '<div class="grid-2">' +
        cardHtml("Live", num(total), "Executions tracked") +
        cardHtml("Success rate", successRate.toFixed(1) + "%", "Completed executions") +
        cardHtml("Cost", money(avgCost), "Average cost per execution") +
        cardHtml("Latency", num(Math.round(avgLatency)) + " ms", "Average latency per execution") +
        '</div>' +
        '<h3 class="card-title" style="font-size:20px;margin:44px 0 14px;">Recent executions</h3>' +
        '<div class="table-wrap">' +
        '<table class="live-table">' +
        '<thead><tr><th>Status</th><th>Model</th><th>Latency</th><th>Cost</th><th>Time</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
        '</table>' +
        '</div>' +
        '<style>' +
        '.live-table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:640px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}' +
        '.live-table th{text-align:left;padding:12px 16px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#555c66;background:#f6f7f9;font-weight:650;}' +
        '.live-table td{padding:12px 16px;border-top:1px solid #e6e8eb;color:#555c66;vertical-align:top;}' +
        '@media (max-width:760px){.live-table{font-size:12px;}.live-table th,.live-table td{padding:10px 10px;}}' +
        '</style>' +
        '</div>' +
        '</section>';

      var main = document.querySelector("main");
      var sections = main ? main.querySelectorAll(".section") : [];
      var ref = sections.length ? sections[sections.length - 1] : main;
      if (ref) {
        ref.insertAdjacentHTML("afterend", html);
      }
    });
  });
})();
