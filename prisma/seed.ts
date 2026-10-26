import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const products = [
    { id: "chips", name: "Lays Chips", pricePaise: 2000, stock: 10 },
    { id: "cola", name: "Coca-Cola", pricePaise: 4000, stock: 8 },
    { id: "chocolate", name: "Dairy Milk", pricePaise: 5000, stock: 6 },
    { id: "biscuits", name: "Biscuits", pricePaise: 1000, stock: 15 },
    { id: "juice", name: "Juice", pricePaise: 3000, stock: 5 },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {},
      create: product,
    });
  }

  console.log("Five snack products seeded successfully!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
