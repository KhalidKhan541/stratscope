(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function firstField(obj, keys, fallback) {
    if (!obj) {
      return fallback;
    }
    for (var i = 0; i < keys.length; i++) {
      var value = obj[keys[i]];
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
    return fallback;
  }

  function formatDate(value) {
    if (!value) {
      return "recently";
    }
    var date = new Date(value);
    if (isNaN(date.getTime())) {
      return "recently";
    }
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function setMessage(el, text, isError) {
    el.innerHTML = text;
    el.style.display = "block";
    el.style.fontSize = "14px";
    el.style.marginTop = "14px";
    el.style.fontWeight = "600";
    el.style.color = isError ? "#b42318" : "#067647";
  }

  function buildRegisterSection() {
    var types = ["coding", "browser", "research", "customer_support", "sales", "other"];
    var options = "";
    for (var i = 0; i < types.length; i++) {
      options += '<option value="' + types[i] + '">' + types[i] + "</option>";
    }

    var section = document.createElement("section");
    section.className = "section agent-register";
    section.innerHTML =
      '<div class="container">' +
      '<div class="section-head center">' +
      '<h2 class="section-title">Register your agent</h2>' +
      '<p class="section-sub">Join the network and contribute anonymized execution data to the corpus.</p>' +
      "</div>" +
      '<div class="form-card">' +
      '<form id="agentRegisterForm" novalidate>' +
      '<label for="agentName">Agent name</label>' +
      '<input type="text" id="agentName" name="name" required placeholder="e.g. support-bot-v3" />' +
      '<label for="agentType">Agent type</label>' +
      '<select id="agentType" name="type">' + options + "</select>" +
      '<label for="agentDescription">Description</label>' +
      '<textarea id="agentDescription" name="description" placeholder="What does your agent do?"></textarea>' +
      '<label for="agentEmail">Email (optional)</label>' +
      '<input type="email" id="agentEmail" name="email" placeholder="you@company.com" />' +
      '<label style="display:flex;align-items:flex-start;gap:10px;font-weight:500;margin-bottom:22px;cursor:pointer;">' +
      '<input type="checkbox" id="agentConsent" name="consent_opt_in" style="width:auto;margin:3px 0 0;min-width:16px;min-height:16px;" />' +
      '<span>Opt in to share anonymized execution data (earn revenue share)</span>' +
      "</label>" +
      '<button type="submit" id="agentSubmitBtn" class="btn btn-primary">Register Agent</button>' +
      "</form>" +
      '<p id="agentFormMessage" style="display:none;" role="status"></p>' +
      "</div>" +
      "</div>";

    var main = document.querySelector("main");
    if (!main) {
      return;
    }
    main.appendChild(section);

    var form = document.getElementById("agentRegisterForm");
    var message = document.getElementById("agentFormMessage");
    var submitBtn = document.getElementById("agentSubmitBtn");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      message.style.display = "none";

      var name = document.getElementById("agentName").value.trim();
      var type = document.getElementById("agentType").value;
      var description = document.getElementById("agentDescription").value.trim();
      var email = document.getElementById("agentEmail").value.trim();
      var consentOptIn = document.getElementById("agentConsent").checked;

      if (!name) {
        setMessage(message, "Please enter an agent name.", true);
        return;
      }
      if (!window.StratScopeAPI || typeof window.StratScopeAPI.registerAgent !== "function") {
        setMessage(message, "Platform API offline \u2014 registration unavailable", true);
        return;
      }

      submitBtn.disabled = true;
      submitBtn.style.opacity = "0.6";
      submitBtn.style.cursor = "wait";

      var payload = {
        name: name,
        type: type,
        description: description,
        email: email,
        consent_opt_in: consentOptIn
      };

      window.StratScopeAPI.registerAgent(payload).then(function (result) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = "";
        submitBtn.style.cursor = "";

        var data = result && result.data ? result.data : result;
        if (data && data.id) {
          setMessage(
            message,
            "&#10003; Agent registered! Your agent ID: <code style=\"background:#f6f7f9;border:1px solid #e6e8eb;border-radius:4px;padding:2px 6px;\">" +
              escapeHtml(data.id) +
              "</code>",
            false
          );
          form.reset();
        } else {
          setMessage(message, "Registration failed. Please try again.", true);
        }
      });
    });
  }

  function renderAgent(agent) {
    var tag = firstField(agent, ["type", "agent_type"], "agent");
    var name = firstField(agent, ["name", "agent_name"], "Unnamed agent");
    var description = firstField(agent, ["description", "bio"], "");
    var dateValue = firstField(
      agent,
      ["created_at", "registered_at", "created", "registered", "timestamp"],
      ""
    );

    var text = escapeHtml(description);
    if (text === "") {
      text = "No description provided.";
    }
    text += "<br/>Registered " + escapeHtml(formatDate(dateValue));

    return (
      '<div class="card">' +
      '<span class="tag">' + escapeHtml(tag) + "</span>" +
      '<h3 class="card-title">' + escapeHtml(name) + "</h3>" +
      '<p class="card-text">' + text + "</p>" +
      "</div>"
    );
  }

  function buildAgentListSection() {
    var section = document.createElement("section");
    section.className = "section agent-list";
    section.innerHTML =
      '<div class="container">' +
      '<div class="section-head center">' +
      '<h2 class="section-title">Registered agents on the network</h2>' +
      "</div>" +
      '<div id="agentList" class="grid-3"></div>' +
      "</div>";

    var main = document.querySelector("main");
    if (!main) {
      return;
    }
    main.appendChild(section);

    var listEl = document.getElementById("agentList");

    if (!window.StratScopeAPI || typeof window.StratScopeAPI.getAgents !== "function") {
      listEl.innerHTML =
        '<div class="card"><span class="tag">Offline</span><h3 class="card-title">Network unreachable</h3>' +
        '<p class="card-text">Platform API offline \u2014 agent list unavailable.</p></div>';
      return;
    }

    window.StratScopeAPI.getAgents().then(function (agents) {
      if (!agents || !agents.length) {
        listEl.innerHTML =
          '<div class="card"><span class="tag">Network</span><h3 class="card-title">No agents registered yet</h3>' +
          '<p class="card-text">Be the first to register your agent and power the network.</p></div>';
        return;
      }
      var html = "";
      for (var i = 0; i < agents.length; i++) {
        html += renderAgent(agents[i]);
      }
      listEl.innerHTML = html;
    });
  }

  ready(function () {
    buildRegisterSection();
    buildAgentListSection();
  });
})();
