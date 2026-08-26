FROM node:20-bookworm-slim

WORKDIR /app

# openssl requis par Prisma pour détecter la target d'engine sur Debian slim.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
