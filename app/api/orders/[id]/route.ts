import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Expire the order if its payment time has ended.
    await prisma.order.updateMany({
      where: {
        id,
        status: "PENDING",
        expiresAt: {
          lte: new Date(),
        },
      },
      data: {
        status: "EXPIRED",
      },
    });

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    const expiresInSeconds =
      order.status === "PENDING"
        ? Math.max(
            0,
            Math.ceil((order.expiresAt.getTime() - Date.now()) / 1000),
          )
        : 0;

    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      totalPaise: order.totalPaise,
      expiresAt: order.expiresAt,
      expiresInSeconds,
      paidAt: order.paidAt,
      pickedUpAt: order.pickedUpAt,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        pricePaise: item.pricePaise,
      })),
    });
  } catch (error) {
    console.error("Get order error:", error);

    return NextResponse.json(
      { message: "Failed to fetch order" },
      { status: 500 },
    );
  }
}
