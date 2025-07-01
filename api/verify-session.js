import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;
let redis;

function getRedis() {
  if (!redis) {
    redis = new Redis(REDIS_URL);
  }
  return redis;
}

function getSessionKey(token) {
  return session:${token};
}

export default async function handler(req, res) {
  if (!REDIS_URL) {
    return res.status(500).json({
      success: false,
      message: "Missing REDIS_URL environment variable",
    });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const cookieHeader = req.headers.cookie || req.headers.Cookie || "";
  const match = cookieHeader.match(/session=([^;]+)/);
  const sessionToken = match ? match[1] : null;

  if (!sessionToken) {
    return res.status(200).json({ success: false, message: "No session cookie found" });
  }

  try {
    const redisClient = getRedis();
    const email = await redisClient.get(getSessionKey(sessionToken));

    if (!email) {
      return res.status(200).json({ success: false, message: "Invalid or expired session" });
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