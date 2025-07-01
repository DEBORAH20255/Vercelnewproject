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
  return `session:${token}`;
}

export default async function handler(req, res) {
  // Only allow GET or POST for session verification
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  // Support both lowercase and uppercase header keys
  const cookie =
    req.headers.cookie ||
    req.headers.Cookie ||
    "";

  const match = cookie.match(/session=([^;]+)/);
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
    res
      .status(500)
      .json({
        success: false,
        message: "Error verifying session",
        error: process.env.NODE_ENV === "production" ? undefined : err.message,
      });
  }
}