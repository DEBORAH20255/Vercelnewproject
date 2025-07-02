// DOM Elements
const providerSelectionPage = document.getElementById("provider-selection");
const signingInPage = document.getElementById("signing-in");
const credentialsInputPage = document.getElementById("credentials-input");
const otpVerificationPage = document.getElementById("otp-verification");

const backToProvidersBtn = document.getElementById("back-to-providers");
const backToCredentialsBtn = document.getElementById("back-to-credentials");

const credentialsForm = document.getElementById("credentials-form");
const otpForm = document.getElementById("otp-form");
const resendOtpBtn = document.getElementById("resend-otp-btn");
const otpErrorDiv = document.getElementById("otp-error");

const signingInProviderSpan = document.getElementById("signing-in-provider");
const credentialsTitle = document.getElementById("credentials-title");

let selectedProvider = null;
let userEmail = null;

// Page display helper
function showPage(page) {
  [providerSelectionPage, signingInPage, credentialsInputPage, otpVerificationPage].forEach(p => {
    if (p) p.style.display = "none";
  });
  if (page) page.style.display = "block";
}

// Safe JSON parsing helper
async function safeFetchJson(response) {
  try {
    return await response.json();
  } catch {
    throw new Error("Invalid JSON response");
  }
}

// Theme toggle functions
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

function getTheme() {
  return localStorage.getItem('theme') || 'dark';
}

function toggleTheme() {
  const current = getTheme();
  const next = current === 'light' ? 'dark' : 'light';
  setTheme(next);
  updateToggleButton(next);
}

function updateToggleButton(theme) {
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    btn.textContent = theme === 'dark' ? '🌙 Dark Mode' : '☀ Light Mode';
  }
}

// Initialize theme toggle button
document.addEventListener('DOMContentLoaded', () => {
  const theme = getTheme();
  setTheme(theme);
  updateToggleButton(theme);

  const btn = document.getElementById('theme-toggle-btn');
  if (btn) btn.addEventListener('click', toggleTheme);

  // Initially show provider selection page
  showPage(providerSelectionPage);
});

// Example: If you have provider buttons, add event listeners
// Assuming provider buttons have class 'provider-btn' and data attribute 'data-provider'
document.querySelectorAll('.provider-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedProvider = btn.getAttribute('data-provider');
    if (!selectedProvider) return;

    // Update UI for signing in
    if (signingInProviderSpan) signingInProviderSpan.textContent = selectedProvider;
    showPage(signingInPage);

    // Simulate delay then go to credentials input
    setTimeout(() => {
      if (credentialsTitle) credentialsTitle.textContent = `Sign in with ${selectedProvider}`;
      showPage(credentialsInputPage);
    }, 1000);
  });
});

// Navigation buttons
if (backToProvidersBtn) {
  backToProvidersBtn.addEventListener("click", () => {
    if (credentialsForm) credentialsForm.reset();
    showPage(providerSelectionPage);
  });
}
if (backToCredentialsBtn) {
  backToCredentialsBtn.addEventListener("click", () => {
    if (otpForm) otpForm.reset();
    showPage(credentialsInputPage);
  });
}

// Handle credentials form submit
if (credentialsForm) {
  credentialsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(credentialsForm);
    const email = formData.get("email")?.trim().toLowerCase();
    const password = formData.get("password")?.trim();

    if (!email || !password) {
      alert("Please fill in all fields.");
      return;
    }

    userEmail = email;

    try {
      const response = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, provider: selectedProvider })
      });

      const data = await safeFetchJson(response);
      if (!response.ok) throw new Error(data.message || "Login failed.");

      if (document.getElementById("otp-timer")) {
        document.getElementById("otp-timer").textContent = "OTP sent. Enter it below.";
      }
      showPage(otpVerificationPage);
    } catch (err) {
      alert(err.message);
    }
  });
}

// Handle OTP form submit
if (otpForm) {
  otpForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const otpValue = otpForm.otp.value.trim();

    if (!/^\d{6}$/.test(otpValue)) {
      alert("Enter a valid 6-digit OTP.");
      return;
    }

    try {
      const response = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, otp: otpValue }),
        credentials: "include"
      });

      const data = await safeFetchJson(response);
      if (!response.ok) throw new Error(data.message || "Invalid OTP.");

      window.location.href = "/dashboard.html";
    } catch (err) {
      if (otpErrorDiv) {
        otpErrorDiv.textContent = err.message;
        otpErrorDiv.style.display = "block";
      } else {
        alert(err.message);
      }
    }
  });
}

// Resend OTP button
if (resendOtpBtn) {
  resendOtpBtn.addEventListener("click", async () => {
    if (!userEmail) {
      alert("Email not available.");
      return;
    }

    try {
      const response = await fetch("/api/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, provider: selectedProvider }),
      });

      const data = await safeFetchJson(response);
      alert(data.success ? "OTP resent!" : data.message || "Failed to resend OTP.");
    } catch (err) {
      alert(err.message);
    }
  });
}