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

COPY package.json package-lock.json ./
# Not --omit=dev, and NODE_ENV=production is set only AFTER this install
# step, not before: npm treats NODE_ENV=production as an implicit
# --omit=dev for `npm ci`/`npm install`, so declaring it earlier silently
# stripped devDependencies even with --omit=dev removed from the command
# itself - a real bug this took two attempts to actually fix, only
# catchable by running the built image, not by reading the Dockerfile.
# The runtime image needs devDependencies present: `npx prisma migrate
# deploy` (CMD below) and `npm run seed` (a one-off documented in the
# README) need the `prisma` CLI and `tsx` respectively, both
# devDependencies.
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=builder /app/dist ./dist
# prisma/seed.ts imports from '../src/lib/password' (the TS source, run
# directly via tsx - it isn't part of the compiled dist/ output). Without
# this, `npm run seed` fails with MODULE_NOT_FOUND: src/ never existed in
# this stage. Found the same way as the two bugs above - by running the
# actual built image, not by reading the Dockerfile.
COPY src ./src

ENV NODE_ENV=production

EXPOSE 4000
# Applies any pending migrations, then starts the API. Safe to run on
# every container start: migrate deploy is a no-op if the DB is already
# up to date.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
