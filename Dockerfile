# Immagine Node.js leggera basata su Alpine
FROM node:20-alpine AS builder

WORKDIR /app

# Installa strumenti di build per compilare better-sqlite3 su alpine
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Immagine di runtime finale ultra-leggera (~100MB)
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app /app

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/index.js"]
