const API_URL = "http://localhost:3000";

// Test product: biscuits.
// We will temporarily set its stock to 2.
// const productId = "biscuits";
const productId = "concurrency-test";

async function createOrder() {
  try {
    const response = await fetch(`${API_URL}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            productId,
            quantity: 1,
          },
        ],
      }),
    });

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

// Send 10 requests at the same time.
const requests = Array.from({ length: 10 }, () => createOrder());

const results = await Promise.all(requests);

const successful = results.filter((result) => result.status === 201);

const conflicts = results.filter((result) => result.status === 409);

console.log("Total requests:", results.length);
console.log("Successful orders:", successful.length);
console.log("Stock conflicts:", conflicts.length);

console.log("\nAll HTTP statuses:");
console.log(results.map((result) => result.status));

if (successful.length === 2 && conflicts.length === 8) {
  console.log("\nPASS: No overselling!");
} else {
  console.error("\nFAIL: Unexpected results.");
  console.log(results);
  process.exitCode = 1;
}
