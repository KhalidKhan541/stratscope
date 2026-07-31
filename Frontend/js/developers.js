(function () {
  var API_URL = "https://stratscope-api.khalidkhan.workers.dev";
  var KEY_PLACEHOLDER = "YOUR_STRATSCOPE_API_KEY";

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

  function hasAncestor(el, tagName) {
    var parent = el.parentElement;
    while (parent) {
      if (parent.tagName === tagName) {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  }

  function replacePlaceholders(text) {
    var out = text;
    out = out.replace(/your-api-key/gi, KEY_PLACEHOLDER);
    out = out.replace(/YOUR_API_KEY/g, KEY_PLACEHOLDER);
    out = out.replace(/api_key/gi, KEY_PLACEHOLDER);
    out = out.replace(/sk-[A-Za-z0-9._\-]+/g, KEY_PLACEHOLDER);
    out = out.replace(/https:\/\/api\.stratscope\.ai/g, API_URL);
    out = out.replace(/https:\/\/api\.example\.com/g, API_URL);
    out = out.replace(/https:\/\/your-api\.example/g, API_URL);
    return out;
  }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {}
    document.body.removeChild(ta);
  }

  function copyText(text, button) {
    function showCopied() {
      button.textContent = "\u2713 Copied";
      setTimeout(function () {
        button.textContent = "Copy";
      }, 2000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showCopied, function () {
        legacyCopy(text);
        showCopied();
      });
    } else {
      legacyCopy(text);
      showCopied();
    }
  }

  function addCopyButton(pre) {
    var container = pre.parentElement;
    if (!container || container.className.indexOf("code-block-wrap") === -1) {
      container = document.createElement("div");
      container.className = "code-block-wrap";
      pre.parentNode.insertBefore(container, pre);
      container.appendChild(pre);
    }
    container.style.position = "relative";

    var button = document.createElement("button");
    button.type = "button";
    button.textContent = "Copy";
    button.style.cssText =
      "position:absolute;top:10px;right:10px;background:#16181d;color:#ffffff;" +
      "border:1px solid #3d4146;font-size:12px;font-weight:600;padding:5px 10px;" +
      "border-radius:6px;cursor:pointer;font-family:inherit;line-height:1.4;";
    button.addEventListener("click", function () {
      copyText(pre.innerText, button);
    });
    container.appendChild(button);
  }

  function addStatusBadge() {
    var api = window.StratScopeAPI;
    if (!api || !api.getStats) {
      return;
    }
    api.getStats().then(function (stats) {
      var count = stats ? Number(stats.executions) || 0 : 0;
      var online = count > 0;
      var fmt = (window.StratScopeAPI.FORMATTERS && window.StratScopeAPI.FORMATTERS.formatNumber) ||
        (window.STRATSCOPE_FORMATTERS && window.STRATSCOPE_FORMATTERS.formatNumber);
      var text = online
        ? "\u25CF API ONLINE \u2014 " + (fmt ? fmt(count) : count) + " executions tracked"
        : "\u25CF API OFFLINE";
      var span = document.createElement("span");
      span.className = "api-status";
      span.textContent = text;
      span.style.cssText =
        "display:inline-block;margin-top:16px;padding:6px 14px;border-radius:999px;" +
        "border:1px solid #e6e8eb;background:#f6f7f9;font-size:12px;font-weight:600;" +
        "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:" +
        (online ? "#0a7d33;" : "#c0392b;");
      var head = document.querySelector(".section-head");
      if (head && head.parentNode) {
        head.parentNode.insertBefore(span, head.nextSibling);
      }
    });
  }

  ready(function () {
    each(document.querySelectorAll("pre, code, .code-block"), function (el) {
      if (el.tagName !== "PRE" && hasAncestor(el, "PRE")) {
        return;
      }
      var replaced = replacePlaceholders(el.textContent);
      if (replaced !== el.textContent) {
        el.textContent = replaced;
      }
    });

    each(document.querySelectorAll("pre"), function (pre) {
      addCopyButton(pre);
    });

    addStatusBadge();
  });
})();
