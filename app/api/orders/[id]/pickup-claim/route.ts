import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id: orderId } = await context.params;

  if (!orderId) {
    return NextResponse.json(
      { message: "Order ID is required" },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Step 1: Lock the order row.
        const lockedOrders = await tx.$queryRaw<{ id: string }[]>`
          SELECT id
          FROM "Order"
          WHERE id = ${orderId}
          FOR UPDATE
        `;

        if (lockedOrders.length === 0) {
          return {
            httpStatus: 404,
            message: "Order not found",
          };
        }

        // Step 2: Read the order and its products.
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { items: true },
        });

        if (!order) {
          return {
            httpStatus: 404,
            message: "Order not found",
          };
        }

        // Step 3: Only PAID orders can be collected.
        if (order.status !== "PAID") {
          return {
            httpStatus: 409,
            message: "Order is not available for pickup",
            orderStatus: order.status,
          };
        }

        // Step 4: Lock product rows in a consistent order.
        const productIds = [
          ...new Set(order.items.map((item) => item.productId)),
        ].sort();

        for (const productId of productIds) {
          await tx.$queryRaw`
            SELECT id
            FROM "Product"
            WHERE id = ${productId}
            FOR UPDATE
          `;
        }

        // Step 5: Decrease physical stock.
        for (const item of order.items) {
          const updated = await tx.product.updateMany({
            where: {
              id: item.productId,
              stock: {
                gte: item.quantity,
              },
            },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });

          if (updated.count !== 1) {
            throw new Error("Insufficient physical stock");
          }
        }

        // Step 6: Mark order as picked up.
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: "PICKED_UP",
            pickedUpAt: new Date(),
          },
        });

        return {
          httpStatus: 200,
          message: "Order picked up successfully",
          orderStatus: "PICKED_UP",
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10000,
        timeout: 15000,
      },
    );

    return NextResponse.json(result, {
      status: result.httpStatus,
    });
  } catch (error) {
    console.error("Pickup claim error:", error);

    return NextResponse.json(
      { message: "Pickup claim failed" },
      { status: 500 },
    );
  }
}
