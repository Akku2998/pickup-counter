import { prisma } from "@/lib/prisma";

export async function expireOrders() {
  const result = await prisma.order.updateMany({
    where: {
      status: "PENDING",
      expiresAt: {
        lte: new Date(),
      },
    },
    data: {
      status: "EXPIRED",
    },
  });

  return result.count;
}
