import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { lockProducts } from "@/lib/order-lock";

type OrderItemInput = {
  productId: string;
  quantity: number;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items: OrderItemInput[] = body.items;

    // Validate the request.
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { message: "Please select at least one product" },
        { status: 400 },
      );
    }

    for (const item of items) {
      if (
        !item ||
        typeof item.productId !== "string" ||
        !item.productId.trim() ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return NextResponse.json(
          { message: "Invalid product or quantity" },
          { status: 400 },
        );
      }
    }

    // Combine repeated products into one item.
    const quantities = new Map<string, number>();

    for (const item of items) {
      const total = (quantities.get(item.productId) ?? 0) + item.quantity;

      if (!Number.isSafeInteger(total)) {
        return NextResponse.json(
          { message: "Quantity is too large" },
          { status: 400 },
        );
      }

      quantities.set(item.productId, total);
    }

    const order = await prisma.$transaction(
      async (tx) => {
        const productIds = [...quantities.keys()];

        // Lock product rows to prevent overselling.
        await lockProducts(tx, productIds);

        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
        });

        if (products.length !== productIds.length) {
          throw new Error("PRODUCT_NOT_FOUND");
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + 120_000);

        let totalPaise = 0;

        const orderItems = [];

        for (const product of products) {
          const quantity = quantities.get(product.id)!;

          // Count units held by unpaid, non-expired orders
          // and paid orders awaiting pickup.
          const reserved = await tx.orderItem.aggregate({
            where: {
              productId: product.id,
              order: {
                OR: [
                  {
                    status: "PENDING",
                    expiresAt: { gt: now },
                  },
                  {
                    status: "PAID",
                  },
                ],
              },
            },
            _sum: { quantity: true },
          });

          const reservedUnits = reserved._sum.quantity ?? 0;
          const availableUnits = product.stock - reservedUnits;

          if (availableUnits < quantity) {
            throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
          }

          const itemTotal = product.pricePaise * quantity;
          totalPaise += itemTotal;

          if (!Number.isSafeInteger(totalPaise)) {
            throw new Error("TOTAL_TOO_LARGE");
          }

          orderItems.push({
            productId: product.id,
            quantity,
            pricePaise: product.pricePaise,
          });
        }

        // Create the order and all items in one transaction.
        return tx.order.create({
          data: {
            status: "PENDING",
            totalPaise,
            expiresAt,
            items: {
              create: orderItems,
            },
          },
          include: { items: true },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10000,
        timeout: 15000,
      },
    );

    const expiresInSeconds = Math.max(
      0,
      Math.ceil((order.expiresAt.getTime() - Date.now()) / 1000),
    );

    return NextResponse.json(
      {
        orderId: order.id,
        status: order.status,
        totalPaise: order.totalPaise,
        expiresAt: order.expiresAt,
        expiresInSeconds,
        items: order.items,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create order error:", error);

    if (error instanceof Error) {
      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json(
          { message: "Product not found" },
          { status: 404 },
        );
      }

      if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
        const productName = error.message.split(":")[1];

        return NextResponse.json(
          { message: `Insufficient stock for ${productName}` },
          { status: 409 },
        );
      }

      if (error.message === "TOTAL_TOO_LARGE") {
        return NextResponse.json(
          { message: "Order total is too large" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { message: "Failed to create order" },
      { status: 500 },
    );
  }
}
