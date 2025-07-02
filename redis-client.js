require("dotenv").config(); // Loads your .env file
const Redis = require("ioredis");

// Connect using your REDIS_URL from the .env file
const redis = new Redis(process.env.REDIS_URL, { tls: {} }); // 'tls: {}' is needed for Upstash

redis.on("connect", () => {
  console.log("Connected to Upstash Redis!");
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

module.exports = redis;