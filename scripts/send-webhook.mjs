import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

// Load the secret from your .env file.
const envText = readFileSync(".env", "utf8");

const secretLine = envText
  .split("\n")
  .find((line) => line.trim().startsWith("WEBHOOK_SECRET="));

if (!secretLine) {
  throw new Error("WEBHOOK_SECRET is missing in .env");
}

const secret = secretLine
  .split("=")
  .slice(1)
  .join("=")
  .trim()
  .replace(/^["']|["']$/g, "");

// Read order ID and optional event ID from terminal.
const orderId = process.argv[2];
const eventId = process.argv[3] || randomUUID();
const amountPaise = Number(process.argv[4] ?? 6000);

if (!orderId) {
  console.error(
    "Usage: node scripts/send-webhook.mjs <orderId> [eventId] [amountPaise]",
  );
  process.exit(1);
}

if (!Number.isSafeInteger(amountPaise) || amountPaise < 0) {
  throw new Error("Invalid payment amount");
}

// Create the payment message.
const payment = {
  eventId,
  orderId,
  amountPaise,
  status: "captured",
};

// Convert the message to JSON text.
const rawBody = JSON.stringify(payment);

// Generate HMAC-SHA256 signature.
const signature = createHmac("sha256", secret)
  .update(rawBody, "utf8")
  .digest("hex");

// Send the webhook to our Next.js API.
const response = await fetch("http://localhost:3000/api/payments/webhook", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Signature": signature,
  },
  body: rawBody,
});

console.log("HTTP Status:", response.status);
console.log("Response:", await response.text());
console.log("Event ID:", eventId);
