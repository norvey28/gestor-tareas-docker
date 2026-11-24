# Imagen del contenedor tareas-app (Node.js), construida en varias etapas.
#   docker build --target test -t tareas-app:test ./app   -> imagen para correr las pruebas
#   docker build -t tareas-app ./app                        -> imagen de produccion (ultima etapa)

FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

# Etapa de pruebas: incluye la carpeta test. Jenkins la usa en la etapa "Pruebas".
FROM base AS test
RUN npm ci
COPY src ./src
COPY public ./public
COPY test ./test
CMD ["node", "--test"]

# Etapa de produccion: solo dependencias de ejecucion y codigo fuente.
FROM base AS produccion
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "src/server.js"]
