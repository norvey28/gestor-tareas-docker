# Imagen del contenedor 1: aplicacion web + API (Node.js)
FROM node:22-alpine

WORKDIR /app

# Primero las dependencias, para aprovechar la cache de capas de Docker
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public

ENV PORT=3000
EXPOSE 3000

USER node
CMD ["node", "src/server.js"]
