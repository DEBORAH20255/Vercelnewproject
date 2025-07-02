import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

let redis;

function getRedis(url) {
  if (!redis) {
    redis = new Redis(url);
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

  if (!REDIS_URL || !BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({
      success: false,
      message: "Missing required environment variables: REDIS_URL, BOT_TOKEN, or CHAT_ID.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  let email, otp;
  try {
    ({ email, otp } = typeof req.body === "string" ? JSON.parse(req.body) : req.body);
  } catch {
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: "Missing email or OTP" });
  }

  email = email.trim().toLowerCase();

  const redisClient = getRedis(REDIS_URL);

  let storedOtp;
  try {
    storedOtp = await redisClient.get(getOtpKey(email));
  } catch {
    return res.status(500).json({ success: false, message: "Internal Redis error" });
  }

  if (!storedOtp) {
    return res.status(400).json({ success: false, message: "OTP not found or expired" });
  }

  if (storedOtp !== otp) {
    return res.status(401).json({ success: false, message: "Invalid OTP" });
  }

  const sessionToken = uuidv4();

  try {
    await redisClient.set(getSessionKey(sessionToken), email, "EX", SESSION_TTL_SECONDS);
    await redisClient.del(getOtpKey(email)); // Remove OTP after verification
  } catch {
    return res.status(500).json({ success: false, message: "Failed to create session" });
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
    console.warn("Telegram notify failed:", e.message);
    // Not fatal
  }

  res.setHeader(
    "Set-Cookie",
    `session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`
  );

  return res.status(200).json({ success: true, message: "OTP verified and session created" });
}