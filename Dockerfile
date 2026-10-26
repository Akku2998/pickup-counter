
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci

COPY . .

# Database URL for Prisma client generation and Next.js build
ENV DATABASE_URL="postgresql://pickup_user:pickup_password@postgres:5432/pickup_db?schema=public"

RUN npx prisma generate --config prisma7.config.ts

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
