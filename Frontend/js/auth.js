// auth.js — sign-in/sign-up logic for auth.html
(function () {
  var API_BASE = "https://stratscope-api.khalidkhan.workers.dev";
  var TOKEN_KEY = "stratscope_session_token";
  var EMAIL_KEY = "stratscope_session_email";

  var ERROR_MESSAGES = {
    access_denied: "Access was denied.",
    invalid_state: "Sign-in expired, please try again.",
    token_exchange_failed: "Sign-in failed, please try again."
  };

  var mode = "login";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function showError(box, message) {
    if (!box) {
      return;
    }
    box.textContent = message;
    box.hidden = false;
  }

  function setMode(nextMode) {
    mode = nextMode;
    var isRegister = mode === "register";
    var nameField = document.getElementById("nameField");
    var submit = document.getElementById("authSubmit");
    var switchText = document.getElementById("authSwitchText");
    var switchLink = document.getElementById("authSwitchLink");
    var password = document.getElementById("authPassword");

    if (nameField) {
      nameField.hidden = !isRegister;
    }
    if (submit) {
      submit.textContent = isRegister ? "Create account" : "Sign in";
    }
    if (switchText) {
      switchText.textContent = isRegister ? "Already have an account?" : "New to StratScope?";
    }
    if (switchLink) {
      switchLink.textContent = isRegister ? "Sign in instead" : "Create an account";
    }
    if (password) {
      password.setAttribute("autocomplete", isRegister ? "new-password" : "current-password");
    }
  }

  ready(function () {
    var box = document.getElementById("authError");
    if (box) {
      var params = new URLSearchParams(window.location.search);
      var code = params.get("error");
      if (code) {
        showError(box, ERROR_MESSAGES[code] || "Sign-in failed, please try again.");
      }
    }

    var switchLink = document.getElementById("authSwitchLink");
    if (switchLink) {
      switchLink.addEventListener("click", function (event) {
        event.preventDefault();
        setMode(mode === "login" ? "register" : "login");
      });
    }

    var form = document.getElementById("authForm");
    if (!form) {
      return;
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var errorBox = document.getElementById("authFormError");
      if (errorBox) {
        errorBox.hidden = true;
      }

      var email = document.getElementById("authEmail").value.trim();
      var password = document.getElementById("authPassword").value;
      var nameInput = document.getElementById("authName");
      var name = nameInput ? nameInput.value.trim() : "";
      var isRegister = mode === "register";

      if (!email || !password) {
        showError(errorBox, "Please enter your email and password.");
        return;
      }
      if (isRegister && password.length < 8) {
        showError(errorBox, "Password must be at least 8 characters.");
        return;
      }

      var submit = document.getElementById("authSubmit");
      if (submit) {
        submit.disabled = true;
        submit.textContent = "Please wait...";
      }

      try {
        var body = { email: email, password: password };
        if (isRegister) {
          body.name = name || undefined;
        }

        var res = await fetch(API_BASE + (isRegister ? "/v1/auth/register" : "/v1/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        var data = await res.json();

        if (!res.ok || !data.data || !data.data.token) {
          var message =
            (data.error && data.error.message) ||
            (data.error && data.error.code) ||
            "Sign-in failed, please try again.";
          showError(errorBox, message);
          return;
        }

        localStorage.setItem(TOKEN_KEY, data.data.token);
        localStorage.setItem(EMAIL_KEY, data.data.user.email);
        window.location.href = "dashboard.html";
      } catch (err) {
        showError(errorBox, "Network error, please try again.");
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.textContent = mode === "register" ? "Create account" : "Sign in";
        }
      }
    });
  });
})();
