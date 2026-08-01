// StratScope user dashboard — authenticated /v1/me views (stats, executions, agents).
(function () {
  const API_BASE = "https://stratscope-api.khalidkhan.workers.dev";
  const AUTH_URL = "auth.html";
  const TOKEN_KEY = "stratscope_session_token";
  const EMAIL_KEY = "stratscope_session_email";

  let token = null;

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text != null) {
      node.textContent = text;
    }
    return node;
  }

  function firstField(obj, keys, fallback) {
    if (!obj || typeof obj !== "object") {
      return fallback;
    }
    for (const key of keys) {
      const value = obj[key];
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
    return fallback;
  }

  function stringValue(value, fallback) {
    if (value === undefined || value === null || value === "") {
      return fallback;
    }
    if (typeof value === "object") {
      return stringValue(value.name || value.id, fallback);
    }
    return String(value);
  }

  function unwrapList(data) {
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === "object") {
      if (Array.isArray(data.data)) {
        return data.data;
      }
      for (const key of ["executions", "agents", "items", "results"]) {
        if (Array.isArray(data[key])) {
          return data[key];
        }
      }
    }
    return [];
  }

  function unwrapObject(data) {
    if (
      data &&
      typeof data === "object" &&
      data.data &&
      typeof data.data === "object" &&
      !Array.isArray(data.data)
    ) {
      return data.data;
    }
    return data && typeof data === "object" ? data : {};
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
  }

  function redirectToAuth() {
    location.replace(AUTH_URL);
  }

  function tokenFromHash() {
    if (!location.hash) {
      return null;
    }
    const params = new URLSearchParams(location.hash.slice(1));
    const hashToken = params.get("token");
    if (!hashToken) {
      return null;
    }
    const email = params.get("email");
    if (email) {
      localStorage.setItem(EMAIL_KEY, email);
    }
    return hashToken;
  }

  function resolveToken() {
    const hashToken = tokenFromHash();
    if (hashToken) {
      localStorage.setItem(TOKEN_KEY, hashToken);
      history.replaceState(null, "", location.pathname + location.search);
      return hashToken;
    }
    return localStorage.getItem(TOKEN_KEY);
  }

  async function apiGet(path) {
    const response = await fetch(API_BASE + path, {
      headers: { Authorization: "Bearer " + token }
    });
    if (response.status === 401) {
      clearSession();
      redirectToAuth();
      throw new Error("Session expired");
    }
    if (!response.ok) {
      throw new Error("Request failed with status " + response.status);
    }
    return response.json();
  }

  const fmtNumber = (value) =>
    value === undefined || value === null || value === "" ? "\u2014" : Number(value).toLocaleString();

  const fmtLatency = (value) =>
    value === undefined || value === null || value === ""
      ? "\u2014"
      : Number(value).toLocaleString() + "ms";

  const fmtCost = (value) => {
    if (value === undefined || value === null || value === "") {
      return "\u2014";
    }
    const n = Number(value);
    if (n > 0.01) {
      return "$" + n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
    }
    return "$" + n.toFixed(4);
  };

  const fmtDate = (value) => {
    if (!value) {
      return "\u2014";
    }
    const date = new Date(value);
    return isNaN(date.getTime()) ? "\u2014" : date.toLocaleString();
  };

  const fmtPercent = (value) => {
    if (value === undefined || value === null || value === "") {
      return "\u2014";
    }
    let n = Number(value);
    if (n > 0 && n <= 1) {
      n = n * 100;
    }
    return n.toFixed(1) + "%";
  };

  function statusBadge(status) {
    const key = stringValue(status, "").toLowerCase().replace(/[^a-z0-9]/g, "_");
    const classes = {
      completed: "completed",
      success: "completed",
      succeeded: "completed",
      ok: "completed",
      failed: "failed",
      error: "failed",
      failure: "failed",
      running: "running",
      in_progress: "running",
      pending: "default"
    };
    return el("span", "status-badge " + (classes[key] || "default"), stringValue(status, "unknown"));
  }

  function renderStats(stats) {
    document.getElementById("statExecutions").textContent = fmtNumber(
      firstField(stats, ["total_executions", "execution_count", "executions", "count"], 0)
    );
    document.getElementById("statSuccessRate").textContent = fmtPercent(
      firstField(stats, ["success_rate", "successRate", "success"], null)
    );
    document.getElementById("statLatency").textContent = fmtLatency(
      firstField(stats, ["avg_latency_ms", "avg_latency", "average_latency_ms", "latency_ms"], null)
    );
    document.getElementById("statCost").textContent = fmtCost(
      firstField(stats, ["total_cost_usd", "total_cost", "cost_usd", "cost"], null)
    );
  }

  function renderExecutions(executions) {
    const empty = document.getElementById("executionsEmpty");
    const table = document.getElementById("executionsTable");
    const tbody = document.getElementById("executionsBody");
    tbody.textContent = "";
    if (!executions.length) {
      table.hidden = true;
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    table.hidden = false;
    for (const execution of executions) {
      const id = stringValue(firstField(execution, ["id", "execution_id", "executionId"], "\u2014"), "\u2014");
      const tr = el("tr");
      const idCell = el("td", "", id.length > 16 ? id.slice(0, 16) + "\u2026" : id);
      if (id.length > 16) {
        idCell.title = id;
      }
      tr.appendChild(idCell);
      const agentCell = el("td");
      agentCell.textContent = stringValue(
        firstField(execution, ["agent_name", "agent", "name"], "\u2014"),
        "\u2014"
      );
      tr.appendChild(agentCell);
      const statusCell = el("td");
      statusCell.appendChild(statusBadge(firstField(execution, ["status", "outcome"], "unknown")));
      tr.appendChild(statusCell);
      tr.appendChild(
        el("td", "", stringValue(firstField(execution, ["model", "model_name", "llm"], "\u2014"), "\u2014"))
      );
      tr.appendChild(
        el("td", "", fmtLatency(firstField(execution, ["latency_ms", "latency", "duration_ms"], null)))
      );
      tr.appendChild(el("td", "", fmtCost(firstField(execution, ["cost_usd", "cost", "total_cost"], null))));
      tr.appendChild(
        el(
          "td",
          "",
          fmtDate(firstField(execution, ["created_at", "created", "timestamp", "started_at"], null))
        )
      );
      tbody.appendChild(tr);
    }
  }

  function renderAgents(agents) {
    const empty = document.getElementById("agentsEmpty");
    const table = document.getElementById("agentsTable");
    const tbody = document.getElementById("agentsBody");
    tbody.textContent = "";
    if (!agents.length) {
      table.hidden = true;
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    table.hidden = false;
    for (const agent of agents) {
      const tr = el("tr");
      tr.appendChild(
        el("td", "", stringValue(firstField(agent, ["name", "agent_name", "agent"], "\u2014"), "\u2014"))
      );
      tr.appendChild(
        el("td", "", fmtNumber(firstField(agent, ["executions", "execution_count", "total_executions"], 0)))
      );
      tr.appendChild(el("td", "", fmtPercent(firstField(agent, ["success_rate", "successRate"], null))));
      tr.appendChild(
        el(
          "td",
          "",
          fmtLatency(firstField(agent, ["avg_latency_ms", "avg_latency", "average_latency_ms", "latency_ms"], null))
        )
      );
      tr.appendChild(
        el(
          "td",
          "",
          fmtDate(firstField(agent, ["last_run", "last_execution_at", "last_run_at", "updated_at", "created_at"], null))
        )
      );
      tbody.appendChild(tr);
    }
  }

  async function signOut() {
    try {
      await fetch(API_BASE + "/v1/auth/logout", {
        method: "POST",
        headers: { Authorization: "Bearer " + token }
      });
    } catch (error) {
      // best-effort logout; local session is cleared regardless
    }
    clearSession();
    redirectToAuth();
  }

  ready(async function () {
    token = resolveToken();
    if (!token) {
      redirectToAuth();
      return;
    }

    const navEmail = document.getElementById("navEmail");
    const savedEmail = localStorage.getItem(EMAIL_KEY);
    if (navEmail) {
      if (savedEmail) {
        navEmail.textContent = savedEmail;
      } else {
        navEmail.hidden = true;
      }
    }

    const signOutBtn = document.getElementById("signOutBtn");
    if (signOutBtn) {
      signOutBtn.addEventListener("click", signOut);
    }

    const lastUpdated = document.getElementById("lastUpdated");
    if (lastUpdated) {
      lastUpdated.hidden = false;
      lastUpdated.textContent = "Last updated " + new Date().toLocaleString();
    }

    const errorBanner = document.getElementById("errorBanner");
    const results = await Promise.allSettled([
      apiGet("/v1/me/stats"),
      apiGet("/v1/me/agents"),
      apiGet("/v1/me/executions?limit=20")
    ]);

    const errors = [];
    if (results[0].status === "fulfilled") {
      renderStats(unwrapObject(results[0].value));
    } else {
      errors.push("Could not load stats.");
    }
    if (results[1].status === "fulfilled") {
      renderAgents(unwrapList(results[1].value));
    } else {
      errors.push("Could not load your agents.");
    }
    if (results[2].status === "fulfilled") {
      renderExecutions(unwrapList(results[2].value));
    } else {
      errors.push("Could not load recent executions.");
    }
    if (errorBanner && errors.length) {
      errorBanner.textContent = errors.join(" ");
      errorBanner.hidden = false;
    }
  });
})();
