FROM node:20-alpine AS build

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm ci

COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/
COPY knexfile.ts ./
COPY .env.example ./.env

RUN npm run build --workspace=client && npm run build --workspace=server && \
    cd server && \
    npx tsc --outDir dist/migrations-compiled --esModuleInterop --skipLibCheck --module commonjs --target ES2020 --resolveJsonModule migrations/*.ts && \
    npx tsc --outDir dist/seeds-compiled --esModuleInterop --skipLibCheck --module commonjs --target ES2020 --resolveJsonModule seeds/*.ts

FROM node:20-alpine

RUN apk add --no-cache vips-dev curl python3 make g++

WORKDIR /app

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package*.json ./server/
COPY --from=build /app/server/dist/migrations-compiled ./server/migrations
COPY --from=build /app/server/dist/seeds-compiled ./server/seeds
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/shared ./shared
COPY --from=build /app/package*.json ./

RUN cd server && npm ci --production

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000

EXPOSE 3000

RUN mkdir -p /app/data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server/dist/server/src/index.js"]
