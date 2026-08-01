// StratScope integration page — shows the logged-in developer their API key,
// project/agent ids, and copy-paste SDK setup instructions.
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

  function copyText(text, button) {
    function fallback() {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (error) {
        ok = false;
      }
      document.body.removeChild(textarea);
      return ok;
    }
    let copied = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          copied = true;
        },
        function () {
          copied = fallback();
        }
      );
    } else {
      copied = fallback();
    }
    if (button) {
      setTimeout(function () {
        button.textContent = copied ? "Copied" : "Copy failed";
        setTimeout(function () {
          button.textContent = "Copy";
        }, 1500);
      }, 100);
    }
  }

  function hookCopyButton(id, getValue) {
    const button = document.getElementById(id);
    if (!button) {
      return;
    }
    button.addEventListener("click", function () {
      copyText(getValue(), button);
    });
  }

  function maskKey(key, prefix) {
    if (!key) {
      return "\u2014";
    }
    const body = prefix && key.indexOf(prefix) === 0 ? key.slice(prefix.length) : key;
    const tail = body.length > 4 ? body.slice(-4) : body;
    return (prefix || "") + "\u2022\u2022\u2022\u2022\u2022\u2022" + tail;
  }

  function showCredentials(data) {
    document.getElementById("apiKeyValue").textContent = maskKey(data.api_key, data.key_prefix);
    document.getElementById("apiKeyStatus").textContent = data.key_retrievable
      ? "Your API key"
      : "API key not retrievable (contact us for a new one)";
    document.getElementById("keyPrefixValue").textContent = data.key_prefix || "\u2014";
    document.getElementById("projectIdValue").textContent = data.project_id || "\u2014";
    document.getElementById("agentIdValue").textContent = data.agent_id || "\u2014";
    document.getElementById("agentNameValue").textContent = data.agent_name || "\u2014";
    document.getElementById("baseUrlValue").textContent = data.base_url || "\u2014";
    document.getElementById("ingestValue").textContent = data.ingest_endpoint || "\u2014";
  }

  function pythonSnippet(data) {
    const base = data.base_url || API_BASE;
    return [
      "import stratscope",
      "",
      "execution = stratscope.start(",
      "    api_key=os.environ[\"STRATSCOPE_API_KEY\"],",
      "    project_id=\"" + (data.project_id || "your-project-id") + "\",",
      "    agent_id=\"" + (data.agent_id || "your-agent-id") + "\",",
      "    base_url=\"" + base + "\",",
      ")",
      "# ... run your agent ...",
      "execution.finish(status=\"completed\", latency_ms=1234)",
      "",
      "# pip install stratscope",
    ].join("\n");
  }

  function tsSnippet(data) {
    const base = data.base_url || API_BASE;
    return [
      "import { startExecution } from \"@stratscope/sdk\";",
      "",
      "const execution = await startExecution({",
      "  apiKey: process.env.STRATSCOPE_API_KEY!,",
      "  projectId: \"" + (data.project_id || "your-project-id") + "\",",
      "  agentId: \"" + (data.agent_id || "your-agent-id") + "\",",
      "  baseUrl: \"" + base + "\",",
      "});",
      "// ... run your agent ...",
      "await execution.finish({ status: \"completed\", latencyMs: 1234 });",
      "",
      "// npm install @stratscope/sdk",
    ].join("\n");
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

    const errorBanner = document.getElementById("errorBanner");
    let data = {};
    try {
      const response = await apiGet("/v1/me/integration");
      data = unwrapObject(response);
    } catch (error) {
      if (errorBanner) {
        errorBanner.textContent = "Could not load integration details. Please try again.";
        errorBanner.hidden = false;
      }
    }

    if (!data.api_key && !data.project_id) {
      const empty = document.getElementById("integrationEmpty");
      if (empty) {
        empty.hidden = false;
      }
    }

    showCredentials(data);
    hookCopyButton("copyApiKeyBtn", function () {
      return data.api_key || "";
    });
    hookCopyButton("copyProjectBtn", function () {
      return data.project_id || "";
    });
    hookCopyButton("copyAgentBtn", function () {
      return data.agent_id || "";
    });
    hookCopyButton("copyBaseUrlBtn", function () {
      return data.base_url || "";
    });
    hookCopyButton("copyPythonBtn", function () {
      return pythonSnippet(data);
    });
    hookCopyButton("copyTsBtn", function () {
      return tsSnippet(data);
    });
  });
})();
