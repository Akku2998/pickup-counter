# AI-Assisted Development Notes

## AI Tools Used

I used ChatGPT as a development assistant while working on this assignment.

## How I Used AI

I used AI assistance for:

- Understanding the assignment requirements and breaking them into smaller tasks.
- Planning the backend APIs, database schema, and order workflow.
- Generating and reviewing implementation examples for Next.js, TypeScript, Prisma, and PostgreSQL.
- Understanding transaction handling, row-level locking, and concurrency.
- Troubleshooting API routing, Prisma configuration, and Docker errors.
- Preparing testing scripts and project documentation.

## Examples of AI-Assisted Debugging

**1. Pickup API returning 404**

The pickup endpoint initially returned a 404 because its route file was located at:

`app/api/orders/pickup-claim/route.ts`

The correct location was:

`app/api/orders/[id]/pickup-claim/route.ts`

After moving the file, I tested the endpoint again and received a successful response.

**2. Docker configuration issue**

The Docker build initially failed because Docker Compose YAML content had been placed inside the `Dockerfile`.

I separated the Docker build instructions from the Compose configuration and ran the build again. The application then started with PostgreSQL, Prisma migrations, and product seeding.

**3. Stock concurrency**

I tested concurrent order requests against limited stock. An initial test used a product with sufficient stock, so it did not properly test overselling.

I corrected the test to use a product with only two available units and verified that two requests succeeded while eight were rejected.

## Verification

I used API responses, terminal logs, database-backed tests, and manual application testing to check the implementation.

The important cases included:

- Limited-stock concurrent order creation.
- Duplicate payment event handling.
- Pickup claim restrictions.
- Two simultaneous pickup requests.
- Docker startup and database connectivity.

## Responsibility

AI-generated suggestions were used as development assistance, not as a substitute for verification. I reviewed the implementation, investigated errors, and used tests to check important behavior.

The final submission reflects the code and functionality present in the repository.
