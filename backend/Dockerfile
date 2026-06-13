FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# curl is the HTTP client for the Truth Social adapter (Cloudflare 403s Node's
# TLS fingerprint; see src/lib/curlFetch.ts).
RUN apk add --no-cache curl
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
COPY seeds ./seeds
EXPOSE 8080
CMD ["node", "dist/index.js"]
