const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL;

let redis;
function getRedis() {
  if (!redis) {
    redis = new Redis(REDIS_URL);
  }
  return redis;
}

function getSessionKey(token) {
  return `session:${token}`; // ← fixed: use backticks for template literal
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  const cookieHeader = req.headers.cookie || req.headers.Cookie || "";
  const match = cookieHeader.match(/session=([^;]+)/);
  const sessionToken = match ? match[1] : null;

  if (!sessionToken) {
    res.status(200).json({ success: false, message: "No session cookie found" });
    return;
  }

  try {
    const redisClient = getRedis();
    const email = await redisClient.get(getSessionKey(sessionToken));

    if (!email) {
      res.status(200).json({ success: false, message: "Invalid or expired session" });
      return;
    }

    res.status(200).json({ success: true, email });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error verifying session",
      error: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }
}