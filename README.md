# Pickup Counter — Full Stack Assignment

A self-service pickup counter application built using Next.js, TypeScript, PostgreSQL, Prisma, and Docker.

Customers can select products, reserve available stock, complete a simulated payment, and collect their orders. The backend is designed to handle concurrent requests, delayed payments, and duplicate webhook events.

## Tech Stack

- **Frontend:** Next.js App Router, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL 17
- **ORM:** Prisma 7
- **Containerization:** Docker and Docker Compose
- **Payment:** Simulated payment webhook with HMAC-SHA256 signature verification

## Features

- Display products with available stock
- Add products to a cart
- Create orders with a 120-second reservation
- Prevent overselling during concurrent orders
- Automatically expire unpaid reservations when checked
- Verify payment webhook signatures
- Prevent duplicate payment event processing
- Mark late or incorrect-amount payments as `NEEDS_REVIEW`
- Allow pickup only after successful payment
- Prevent the same order from being collected twice
- Update physical stock when an order is collected
- Display order status and a live countdown

## Getting Started

### Requirements

- Docker Desktop
- Docker Compose

### Run the Application

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://pickup_user:pickup_password@localhost:5434/pickup_db?schema=public"
WEBHOOK_SECRET="replace-with-a-long-random-secret"
```

Then run:

```bash
docker compose up --build
```

Docker Compose starts PostgreSQL and the Next.js application. The application startup command also applies Prisma migrations and runs the seed script.

Open:

http://localhost:3000

### Stop the Application

```bash
docker compose down
```

The database volume is preserved between restarts.

## Order Workflow

1. The customer selects products and quantities.
2. The backend checks available stock and creates a `PENDING` order.
3. Stock is reserved for 120 seconds.
4. The payment webhook verifies the signature, amount, and reservation expiry.
5. A valid payment changes the order status to `PAID`.
6. The customer clicks **Collect Order**.
7. The backend decreases physical stock and changes the status to `PICKED_UP`.

### Order Statuses

| Status         | Meaning                                         |
| -------------- | ----------------------------------------------- |
| `PENDING`      | Waiting for payment                             |
| `PAID`         | Payment accepted; ready for collection          |
| `EXPIRED`      | Reservation expired without an accepted payment |
| `NEEDS_REVIEW` | Payment requires manual review                  |
| `PICKED_UP`    | Order collected successfully                    |

## API Endpoints

| Method | Endpoint                       | Purpose                                         |
| ------ | ------------------------------ | ----------------------------------------------- |
| GET    | `/api/products`                | List products and available stock               |
| POST   | `/api/orders`                  | Create an order and reserve stock               |
| GET    | `/api/orders/:id`              | Get order status and remaining reservation time |
| POST   | `/api/payments/webhook`        | Process a signed payment event                  |
| POST   | `/api/orders/:id/pickup-claim` | Collect a paid order                            |

## Stock Management

Available stock is calculated using:

```text
Available Stock = Physical Stock - Active Pending Reservations - Paid Uncollected Orders
```

Expired pending reservations no longer block available stock.

Physical stock is reduced only when an order is successfully collected.

## Concurrency Handling

Order creation uses PostgreSQL transactions and row-level locks to protect product stock from concurrent reservations.

Pickup claims also use a transaction and row-level locking to ensure that only one claim succeeds for each paid order.

## Payment Webhook

The payment endpoint expects a JSON body containing:

```json
{
  "eventId": "payment-event-001",
  "orderId": "ORDER_ID",
  "amountPaise": 6000,
  "status": "captured"
}
```

The request must include a valid `X-Signature` header generated using HMAC-SHA256 and the configured webhook secret.

Each `eventId` is stored uniquely to prevent duplicate processing.

To simulate payment locally:

```bash
node scripts/send-webhook.mjs ORDER_ID EVENT_ID AMOUNT_PAISE
```

Use the exact order total in paise. For example, ₹80 is `8000` paise.

## Testing

The project includes scripts for concurrency testing.

### Reservation Concurrency

```bash
node scripts/test-concurrency.mjs
```

This checks concurrent attempts to reserve limited stock.

### Pickup Concurrency

```bash
node scripts/test-pickup.mjs PAID_ORDER_ID
```

This checks that two simultaneous pickup claims cannot both succeed.

### Manual Testing

1. Open the application.
2. Add products to the cart.
3. Create an order.
4. Send a valid simulated payment webhook.
5. Wait for the frontend to show `PAID`.
6. Click **Collect Order**.
7. Verify that the order becomes `PICKED_UP`.

## Important Design Decisions

- Prices are stored as integer paise to avoid floating-point currency errors.
- PostgreSQL transactions and row locks protect stock consistency.
- Payment events use unique IDs for idempotency.
- Late or mismatched payments are flagged for review instead of automatically accepted.
- The frontend polls the server for the latest order status.

## AI Usage

AI-assisted development was used during implementation. Details are documented in `AI_NOTES.md`.
