export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { email, provider } = body || {};

    if (!email || !provider) {
      return res.status(400).json({ success: false, message: "Missing email or provider" });
    }

    // Forward to send-otp logic with resend: true
    const response = await fetch(`${process.env.VERCEL_URL ? https://${process.env.VERCEL_URL} : ""}/api/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, provider, resend: true }),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ success: false, message: "Internal error", error: err.message });
  }
}