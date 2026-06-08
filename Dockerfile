FROM node:20-alpine AS build

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

RUN npm run build

FROM node:20-alpine

RUN apk add --no-cache vips-dev

WORKDIR /app

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package*.json ./server/
COPY --from=build /app/server/migrations ./server/migrations
COPY --from=build /app/server/seeds ./server/seeds
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/shared ./shared
COPY --from=build /app/package*.json ./

RUN cd server && npm ci --production

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000

EXPOSE 3000

RUN mkdir -p /app/data

CMD ["node", "server/dist/index.js"]
