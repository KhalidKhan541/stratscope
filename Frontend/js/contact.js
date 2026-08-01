(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function setStatus(el, text, isError) {
    el.style.display = "block";
    el.style.fontSize = "14px";
    el.style.marginTop = "14px";
    el.style.fontWeight = "600";
    el.style.color = isError ? "#b42318" : "#067647";
    el.textContent = text;
  }

  ready(function () {
    var yearEl = document.getElementById("year");
    if (yearEl) {
      yearEl.textContent = String(new Date().getFullYear());
    }

    var form = document.getElementById("contactForm");
    if (!form) {
      return;
    }

    var statusEl = document.getElementById("contactStatus");
    var submitBtn = document.getElementById("contactSubmitBtn");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      statusEl.style.display = "none";

      var name = document.getElementById("contactName").value.trim();
      var email = document.getElementById("contactEmail").value.trim();
      var agentName = document.getElementById("contactAgent").value.trim();
      var subject = document.getElementById("contactSubject").value.trim();
      var message = document.getElementById("contactMessageText").value.trim();
      var requestKey = document.getElementById("contactRequestKey").checked;
      var website = form.querySelector('input[name="website"]').value.trim();

      if (!name) {
        setStatus(statusEl, "Please enter your name.", true);
        return;
      }
      if (!email) {
        setStatus(statusEl, "Please enter your email address.", true);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus(statusEl, "Please enter a valid email address.", true);
        return;
      }

      var apiBase =
        window.STRATSCOPE_API_BASE || "https://stratscope-api.khalidkhan.workers.dev";

      submitBtn.disabled = true;
      submitBtn.style.opacity = "0.6";
      submitBtn.style.cursor = "wait";
      submitBtn.textContent = "Sending...";

      var payload = {
        name: name,
        email: email,
        agent_name: agentName,
        subject: subject,
        message: message,
        request_key: requestKey,
        website: website
      };

      function restoreButton() {
        submitBtn.disabled = false;
        submitBtn.style.opacity = "";
        submitBtn.style.cursor = "";
        submitBtn.textContent = "Send message";
      }

      fetch(apiBase + "/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (response) {
          return response.json().then(function (data) {
            return { status: response.status, data: data };
          });
        })
        .then(function (result) {
          restoreButton();
          if (result.status === 201) {
            setStatus(
              statusEl,
              "Thanks! Check your inbox — if you requested a key it's on its way.",
              false
            );
            form.reset();
          } else if (result.status === 429) {
            setStatus(statusEl, "Too many requests — try again tomorrow.", true);
          } else {
            var errMsg =
              (result.data && result.data.error && result.data.error.message) ||
              (result.data && result.data.message) ||
              "Something went wrong — please try again.";
            setStatus(statusEl, errMsg, true);
          }
        })
        .catch(function () {
          restoreButton();
          setStatus(
            statusEl,
            "Network error — couldn't reach the server. Please try again.",
            true
          );
        });
    });
  });
})();
