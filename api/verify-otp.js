import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
let redis;

function getRedis(REDIS_URL) {
  if (!redis) {
    redis = new Redis(REDIS_URL);
  }
  return redis;
}

function getOtpKey(email) {
  return `otp:${email}`;
}

function getSessionKey(token) {
  return `session:${token}`;
}

export default async function handler(req, res) {
  const REDIS_URL = process.env.REDIS_URL;
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const CHAT_ID = process.env.CHAT_ID;

  // ENV var check inside handler
  if (!REDIS_URL || !BOT_TOKEN || !CHAT_ID) {
    res.status(500).json({ success: false, message: "Missing required environment variables: REDIS_URL, BOT_TOKEN, or CHAT_ID." });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  let email, otp;
  try {
    ({ email, otp } = typeof req.body === "string" ? JSON.parse(req.body) : req.body);
  } catch {
    res.status(400).json({ success: false, message: "Invalid JSON body" });
    return;
  }

  if (!email || !otp) {
    res.status(400).json({ success: false, message: "Missing email or OTP" });
    return;
  }

  email = email.trim().toLowerCase();
  const redisClient = getRedis(REDIS_URL);

  let storedOtp;
  try {
    storedOtp = await redisClient.get(getOtpKey(email));
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal Redis error" });
    return;
  }

  if (!storedOtp) {
    res.status(400).json({ success: false, message: "OTP not found or expired" });
    return;
  }

  if (storedOtp !== otp) {
    res.status(401).json({ success: false, message: "Invalid OTP" });
    return;
  }

  const sessionToken = uuidv4();
  try {
    await redisClient.set(getSessionKey(sessionToken), email, "EX", SESSION_TTL_SECONDS);
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create session" });
    return;
  }

  const message = [
    "✅ OTP Verified",
    `📧 Email: ${email}`,
    `🍪 Session: ${sessionToken}`,
    `⏳ Valid: 7 days`,
  ].join("\n");

  const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    });
  } catch (e) {
    console.error("Telegram notify failed:", e);
  }

  // Set HttpOnly cookie for session token
  res.setHeader(
    "Set-Cookie",
    `session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`
  );

  res.status(200).json({ success: true, message: "OTP verified and session created" });
}