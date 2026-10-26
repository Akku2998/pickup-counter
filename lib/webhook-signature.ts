import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebhookSignature(
  rawBody: string,
  receivedSignature: string | null,
): boolean {
  const secret = process.env.WEBHOOK_SECRET;

  // Reject if secret or signature is missing.
  if (!secret || !receivedSignature) {
    return false;
  }

  // Calculate the expected signature.
  const expectedSignature = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  // A SHA-256 hex signature has 64 characters.
  if (!/^[a-fA-F0-9]{64}$/.test(receivedSignature)) {
    return false;
  }

  // Convert both signatures to bytes.
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  const receivedBuffer = Buffer.from(receivedSignature, "hex");

  // Compare without leaking timing information.
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
