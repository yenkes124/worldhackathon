# Build the Vite client, then serve dist/ + POST /api/token with server/serve.mjs.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/dist ./dist
COPY server ./server
COPY package.json ./
EXPOSE 8080
CMD ["node", "server/serve.mjs"]
