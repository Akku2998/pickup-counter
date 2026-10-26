import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/webhook-signature";

type PaymentPayload = {
  eventId: string;
  orderId: string;
  amountPaise: number;
  status: "captured";
};

export async function POST(request: NextRequest) {
  try {
    // 1. Read the original JSON text.
    const rawBody = await request.text();

    // 2. Read the signature from the request header.
    const signature = request.headers.get("X-Signature");

    // 3. Verify the signature before processing payment.
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json(
        { message: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    // 4. Convert JSON text into a JavaScript object.
    let body: PaymentPayload;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { message: "Invalid JSON body" },
        { status: 400 },
      );
    }

    // 5. Validate required fields.
    if (
      !body ||
      typeof body.eventId !== "string" ||
      !body.eventId.trim() ||
      typeof body.orderId !== "string" ||
      !body.orderId.trim() ||
      !Number.isSafeInteger(body.amountPaise) ||
      body.amountPaise < 0 ||
      body.status !== "captured"
    ) {
      return NextResponse.json(
        { message: "Invalid payment details" },
        { status: 400 },
      );
    }

    // 6. Process the payment inside a database transaction.
    const result = await prisma.$transaction(
      async (tx) => {
        // Lock the order to protect against concurrent webhook calls.
        const lockedOrders = await tx.$queryRaw<{ id: string }[]>`
          SELECT id
          FROM "Order"
          WHERE id = ${body.orderId}
          FOR UPDATE
        `;

        if (lockedOrders.length === 0) {
          return {
            httpStatus: 404,
            message: "Order not found",
          };
        }

        // Check whether this event was already processed.
        const existingEvent = await tx.paymentEvent.findUnique({
          where: {
            eventId: body.eventId,
          },
        });

        if (existingEvent) {
          return {
            httpStatus: 200,
            message: "Payment event already processed",
          };
        }

        // Get the latest order details.
        const order = await tx.order.findUnique({
          where: {
            id: body.orderId,
          },
        });

        if (!order) {
          return {
            httpStatus: 404,
            message: "Order not found",
          };
        }

        const now = new Date();

        // Store the payment event once.
        await tx.paymentEvent.create({
          data: {
            eventId: body.eventId,
            orderId: body.orderId,
            amountPaise: body.amountPaise,
            status: body.status,
          },
        });

        // Already paid or picked up: don't change it again.
        if (order.status === "PAID" || order.status === "PICKED_UP") {
          return {
            httpStatus: 200,
            message: "Order payment already completed",
            orderStatus: order.status,
          };
        }

        // Incorrect amount: manual review.
        if (body.amountPaise !== order.totalPaise) {
          await tx.order.update({
            where: { id: order.id },
            data: { status: "NEEDS_REVIEW" },
          });

          return {
            httpStatus: 200,
            message: "Payment amount mismatch",
            orderStatus: "NEEDS_REVIEW",
          };
        }

        // Expired order or late payment: manual review.
        if (
          order.status === "EXPIRED" ||
          order.expiresAt <= now ||
          order.status === "NEEDS_REVIEW"
        ) {
          await tx.order.update({
            where: { id: order.id },
            data: { status: "NEEDS_REVIEW" },
          });

          return {
            httpStatus: 200,
            message: "Payment requires manual review",
            orderStatus: "NEEDS_REVIEW",
          };
        }

        // Valid, on-time payment.
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "PAID",
            paidAt: now,
          },
        });

        return {
          httpStatus: 200,
          message: "Payment captured successfully",
          orderStatus: "PAID",
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
    console.error("Payment webhook error:", error);

    // Another concurrent request may have saved the same event ID.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "Payment event already processed" },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { message: "Payment processing failed" },
      { status: 500 },
    );
  }
}
