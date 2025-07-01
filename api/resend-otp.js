import fetch from "node-fetch"; // Only needed if Node < 18

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

    // Correct base URL construction
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "";

    // Forward to send-otp logic with resend: true
    const response = await fetch(`${baseUrl}/api/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, provider, resend: true }),
    });

    // Robust response handling
    let data;
    try {
      data = await response.json();
    } catch (e) {
      const text = await response.text();
      return res.status(500).json({ success: false, message: "Upstream error", error: text });
    }

    return res.status(response.status).json(data);
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ success: false, message: "Internal error", error: err.message });
  }
}