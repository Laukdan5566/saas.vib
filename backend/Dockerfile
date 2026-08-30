FROM node:22-alpine AS build

WORKDIR /app
RUN apk add --no-cache openssl
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm prisma generate && pnpm run build

FROM node:22-alpine

WORKDIR /app
RUN apk add --no-cache openssl
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY agent-assets ./agent-assets

ENV NODE_ENV=production
EXPOSE 3000

CMD sh -c "pnpm prisma migrate deploy && pnpm prisma db seed && node dist/src/main.js"
