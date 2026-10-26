import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expireOrders } from "@/lib/expire-orders";

export async function GET() {
  try {
    // Step 1: Mark expired orders as EXPIRED.
    await expireOrders();

    // Step 2: Get all products.
    const products = await prisma.product.findMany({
      orderBy: {
        name: "asc",
      },
    });

    // Step 3: Find quantities reserved by active orders.
    const reservations = await prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          OR: [
            {
              status: "PENDING",
              expiresAt: {
                gt: new Date(),
              },
            },
            {
              status: "PAID",
            },
          ],
        },
      },
      _sum: {
        quantity: true,
      },
    });

    // Step 4: Store reserved quantities by product ID.
    const reservedMap = new Map<string, number>();

    for (const reservation of reservations) {
      reservedMap.set(reservation.productId, reservation._sum.quantity ?? 0);
    }

    // Step 5: Calculate available stock.
    const result = products.map((product) => {
      const reservedUnits = reservedMap.get(product.id) ?? 0;

      return {
        id: product.id,
        name: product.name,
        pricePaise: product.pricePaise,
        availableUnits: Math.max(0, product.stock - reservedUnits),
      };
    });

    return NextResponse.json(result, {
      status: 200,
    });
  } catch (error) {
    console.error("Products API error:", error);

    return NextResponse.json(
      { message: "Failed to fetch products" },
      { status: 500 },
    );
  }
}

// import { NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";

// export async function GET() {
//   try {
//     const now = new Date();

//     const products = await prisma.product.findMany({
//       orderBy: {
//         name: "asc",
//       },
//       include: {
//         orderItems: {
//           where: {
//             order: {
//               OR: [
//                 {
//                   status: "PENDING",
//                   expiresAt: {
//                     gt: now,
//                   },
//                 },
//                 {
//                   status: "PAID",
//                 },
//               ],
//             },
//           },
//           select: {
//             quantity: true,
//           },
//         },
//       },
//     });

//     const result = products.map((product) => {
//       const reservedUnits = product.orderItems.reduce(
//         (total, item) => total + item.quantity,
//         0,
//       );

//       return {
//         id: product.id,
//         name: product.name,
//         pricePaise: product.pricePaise,
//         availableUnits: Math.max(0, product.stock - reservedUnits),
//       };
//     });

//     return NextResponse.json(result, {
//       status: 200,
//     });
//   } catch (error) {
//     console.error("Get products error:", error);

//     return NextResponse.json(
//       { message: "Failed to fetch products" },
//       { status: 500 },
//     );
//   }
// }

// import { NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";

// export async function GET() {
//   try {
//     const products = await prisma.product.findMany({
//       orderBy: {
//         name: "asc",
//       },
//     });

//     const result = products.map((product) => ({
//       id: product.id,
//       name: product.name,
//       pricePaise: product.pricePaise,
//       availableUnits: product.stock,
//     }));

//     return NextResponse.json(result, {
//       status: 200,
//     });
//   } catch (error) {
//     console.error("Products API error:", error);

//     return NextResponse.json(
//       { message: "Failed to fetch products" },
//       { status: 500 },
//     );
//   }
// }
