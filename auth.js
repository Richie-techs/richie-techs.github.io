(() => {
  const url = window.SHIPTRACK_SUPABASE_URL;
  const key = window.SHIPTRACK_SUPABASE_PUBLISHABLE_KEY;

  function showMessage(element, message, type = "error") {
    if (!element) return;
    element.textContent = message;
    element.className = `form-message ${type}`;
  }

  function getClient() {
    if (!window.supabase || !url || !key ||
        url.includes("PASTE_YOUR") || key.includes("PASTE_YOUR")) {
      throw new Error("Supabase is not configured. Add your Project URL and publishable key in config.js.");
    }
    return window.supabase.createClient(url, key);
  }

  let client;
  try {
    client = getClient();
  } catch (error) {
    const target = document.getElementById("loginMessage") ||
                   document.getElementById("signupMessage");
    showMessage(target, error.message);
    return;
  }

  // If a valid session already exists, send the customer to the protected dashboard.
  client.auth.getSession().then(({ data, error }) => {
    if (!error && data.session &&
        (location.pathname.endsWith("/index.html") ||
         location.pathname.endsWith("/signup.html") ||
         location.pathname.endsWith("/"))) {
      location.replace("tracking.html");
    }
  });

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    const message = document.getElementById("loginMessage");
    const button = document.getElementById("loginButton");

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      button.textContent = "Signing in…";
      showMessage(message, "");

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      try {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.replace("tracking.html");
      } catch (error) {
        showMessage(message, error.message || "Unable to sign in. Check your connection and details.");
        button.disabled = false;
        button.textContent = "Sign in";
      }
    });

    document.getElementById("togglePassword").addEventListener("click", (event) => {
      const input = document.getElementById("password");
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      event.currentTarget.textContent = visible ? "Hide" : "Show";
      event.currentTarget.setAttribute("aria-label", visible ? "Hide password" : "Show password");
    });

    document.getElementById("forgotPassword").addEventListener("click", async () => {
      const email = document.getElementById("email").value.trim();
      if (!email) {
        showMessage(message, "Enter your email address first, then select Forgot password.");
        return;
      }
      try {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}${location.pathname.replace(/index\.html$/, "")}reset-password.html`
        });
        if (error) throw error;
        showMessage(message, "If an account exists for this email, a password-reset link will be sent.", "success");
      } catch (error) {
        showMessage(message, error.message || "Could not request a password reset.");
      }
    });
  }

  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    const message = document.getElementById("signupMessage");
    const button = document.getElementById("signupButton");

    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fullName = document.getElementById("fullName").value.trim();
      const email = document.getElementById("signupEmail").value.trim();
      const password = document.getElementById("signupPassword").value;
      const confirmPassword = document.getElementById("confirmPassword").value;

      if (password.length < 8) {
        showMessage(message, "Your password must contain at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        showMessage(message, "The passwords do not match.");
        return;
      }

      button.disabled = true;
      button.textContent = "Creating account…";
      showMessage(message, "");

      try {
        const redirectBase = `${location.origin}${location.pathname.replace(/signup\.html$/, "")}`;
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${redirectBase}index.html`
          }
        });
        if (error) throw error;

        if (data.session) {
          showMessage(message, "Account created. Opening your dashboard…", "success");
          location.replace("tracking.html");
        } else {
          showMessage(message, "Account created. Check your email and confirm your address, then return here to sign in.", "success");
          button.disabled = false;
          button.textContent = "Create account";
          signupForm.reset();
        }
      } catch (error) {
        showMessage(message, error.message || "Unable to create account. Check your connection and try again.");
        button.disabled = false;
        button.textContent = "Create account";
      }
    });
  }
})();
