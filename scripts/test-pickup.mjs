const API_URL = "http://localhost:3000";

// Pass a PAID order ID when running this script.
const orderId = process.argv[2];

if (!orderId) {
  console.error("Usage: node scripts/test-pickup.mjs YOUR_PAID_ORDER_ID");
  process.exit(1);
}

async function claimPickup() {
  try {
    const response = await fetch(
      `${API_URL}/api/orders/${orderId}/pickup-claim`,
      {
        method: "POST",
      },
    );

    return {
      status: response.status,
      body: await response.json(),
    };
  } catch (error) {
    return {
      status: 0,
      body: { message: String(error) },
    };
  }
}

// Send both pickup requests at the same time.
const results = await Promise.all([claimPickup(), claimPickup()]);

console.log("\nPickup Results:");

results.forEach((result, index) => {
  console.log(`\nRequest ${index + 1}`);
  console.log("HTTP Status:", result.status);
  console.log("Response:", result.body);
});

const successCount = results.filter((result) => result.status === 200).length;

const conflictCount = results.filter((result) => result.status === 409).length;

if (successCount === 1 && conflictCount === 1) {
  console.log("\nPASS: Only one pickup succeeded!");
} else {
  console.log("\nFAIL: Unexpected pickup results.");
  process.exitCode = 1;
}
