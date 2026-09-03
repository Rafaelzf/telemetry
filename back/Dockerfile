FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY src/database/migrations ./src/database/migrations
COPY src/database/migrate.ts ./src/database/migrate.ts
COPY src/config/env.ts ./src/config/env.ts
COPY tsconfig.json ./

EXPOSE 3000
CMD ["sh", "-c", "npx tsx src/database/migrate.ts latest && node dist/app.js"]
