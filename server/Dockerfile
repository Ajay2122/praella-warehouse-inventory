# --- deps + build ---
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 4000
# Applies any pending migrations, then starts the API. Safe to run on
# every container start: migrate deploy is a no-op if the DB is already
# up to date.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
