document.addEventListener("DOMContentLoaded", () => {
  const providerSelectionPage = document.getElementById("provider-selection");
  const credentialsInputPage = document.getElementById("credentials-input");
  const otpVerificationPage = document.getElementById("otp-verification");
  const signingInPage = document.getElementById("signing-in");
  const credentialsTitle = document.getElementById("credentials-title");
  const credentialsForm = document.getElementById("credentials-form");
  const otpForm = document.getElementById("otp-form");
  const backToProvidersBtn = document.getElementById("back-to-providers");
  const backToCredentialsBtn = document.getElementById("back-to-credentials");
  const resendOtpBtn = document.getElementById("resend-otp-btn");
  const providerButtons = document.querySelectorAll(".provider-btn");

  let selectedProvider = null;
  let userEmail = null;

  function showPage(page) {
    [providerSelectionPage, credentialsInputPage, otpVerificationPage, signingInPage]
      .forEach(p => p && p.classList.remove("active"));
    page.classList.add("active");
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

providerButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    selectedProvider = btn.dataset.provider;
    document.getElementById("signing-in-provider").textContent = capitalize(selectedProvider);
    showPage(signingInPage);

    setTimeout(() => {
      credentialsTitle.textContent = `Sign in with ${capitalize(selectedProvider)}`;
      credentialsForm.reset();
      showPage(credentialsInputPage);
    }, 1200);
  });
});

  backToProvidersBtn.addEventListener("click", () => {
    credentialsForm.reset();
    showPage(providerSelectionPage);
  });

  backToCredentialsBtn.addEventListener("click", () => {
    otpForm.reset();
    showPage(credentialsInputPage);
  });

  credentialsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(credentialsForm);
    const email = formData.get("email").trim().toLowerCase();
    const password = formData.get("password").trim();

    if (!email || !password) return alert("Please fill in all fields.");

    userEmail = email;

    const response = await fetch("/api/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, provider: selectedProvider })
    });

    const data = await response.json();
    if (data.success) {
      showPage(otpVerificationPage);
      document.getElementById("otp-timer").textContent = "OTP sent. Enter it below.";
    } else {
      alert(data.message || "Login failed.");
    }
  });

  otpForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const otpValue = otpForm.otp.value.trim();
    if (!/^\d{6}$/.test(otpValue)) return alert("Enter a valid 6-digit OTP.");

    const response = await fetch("/api/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail, otp: otpValue }),
      credentials: "include"
    });

    const data = await response.json();
    if (data.success) {
      window.location.href = "/dashboard.html";
    } else {
      alert(data.message || "Invalid OTP.");
    }
  });

  resendOtpBtn.addEventListener("click", async () => {
    if (!userEmail) return alert("Email not available.");

    const response = await fetch("/api/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail, provider: selectedProvider, resend: true }),
    });

    const data = await response.json();
    alert(data.success ? "OTP resent!" : data.message || "Failed to resend OTP.");
  });
});