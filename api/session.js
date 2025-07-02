import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;
let redis;

function getRedis() {
  if (!redis) {
    redis = new Redis(REDIS_URL, { tls: {} });
  }
  return redis;
}

function getSessionKey(token) {
  return `session:${token}`;
}

export default async function handler(req, res) {
  if (!REDIS_URL) {
    res.status(500).json({ success: false, message: "Missing REDIS_URL env var" });
    return;
  }

  const redisClient = getRedis();

  // Parse cookies from header
  const cookieHeader = req.headers.cookie || "";
  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map(c => c.trim().split("="))
      .filter(parts => parts.length === 2)
  );

  const sessionToken = cookies.session;

  if (!sessionToken) {
    res.status(401).json({ success: false, message: "No session cookie found" });
    return;
  }

  try {
    const email = await redisClient.get(getSessionKey(sessionToken));

    if (!email) {
      res.status(401).json({ success: false, message: "Invalid or expired session" });
      return;
    }

    res.status(200).json({ success: true, email });
  } catch (err) {
    console.error("Redis error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}