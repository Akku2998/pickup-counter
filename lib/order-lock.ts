import { Prisma } from "@/app/generated/prisma/client";

type TransactionClient = Prisma.TransactionClient;

export async function lockProducts(
  tx: TransactionClient,
  productIds: string[],
) {
  // Sort IDs so concurrent requests lock products
  // in the same order, reducing deadlock risk.
  const sortedIds = [...new Set(productIds)].sort();

  for (const productId of sortedIds) {
    await tx.$queryRaw`
      SELECT id
      FROM "Product"
      WHERE id = ${productId}
      FOR UPDATE
    `;
  }
}
