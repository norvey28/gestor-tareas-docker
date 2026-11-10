# Gestor de tareas con Docker

Proyecto del módulo **Énfasis Profesional I (Integración Continua)** — Politécnico Grancolombiano.
**Entrega 1 (semana 3):** dos contenedores Docker comunicados entre sí.

| Contenedor   | Imagen                         | Función                                   | Puerto |
|--------------|--------------------------------|-------------------------------------------|--------|
| `tareas-app` | `tareas-app` (Node.js 22, propia) | Página web + API REST del gestor de tareas | 3000   |
| `tareas-db`  | `mysql:8.4`                    | Base de datos MySQL                        | 3306 (solo red interna) |

Los dos contenedores comparten la red `tareas-net`. La aplicación se conecta a la base de
datos usando el **nombre del contenedor** (`tareas-db`) como host; Docker resuelve ese nombre
dentro de la red.

```
Navegador ──► localhost:3000 ──► [ tareas-app ] ──► tareas-db:3306 ──► [ tareas-db ]
                                  Node.js/Express      red tareas-net      MySQL 8.4
```

## Requisitos

- Docker Desktop instalado y en ejecución
- Git

## Opción A: paso a paso con comandos Docker

```bash
git clone https://github.com/TU_USUARIO/gestor-tareas-docker.git
cd gestor-tareas-docker

# 1. Red compartida
docker network create tareas-net

# 2. Contenedor de base de datos
docker run -d --name tareas-db --network tareas-net -e MYSQL_ROOT_PASSWORD=123456 -e MYSQL_DATABASE=tareasdb mysql:8.4

# 3. Imagen y contenedor de la aplicación
docker build -t tareas-app ./app
docker run -d --name tareas-app --network tareas-net -p 3000:3000 -e DB_HOST=tareas-db -e DB_PASSWORD=123456 -e DB_NAME=tareasdb tareas-app
```

Abrir <http://localhost:3000>. La aplicación reintenta la conexión mientras MySQL termina de
arrancar (puede tardar cerca de un minuto la primera vez).

## Opción B: Docker Compose

```bash
docker compose up -d --build
```

## Comprobar la comunicación entre contenedores

```bash
docker ps                                            # los dos contenedores en ejecución
docker network inspect tareas-net                    # ambos aparecen en la misma red
docker exec -u root tareas-app ping -c 3 tareas-db   # la app alcanza a la base de datos por nombre
docker logs tareas-app                               # "Conectado a MySQL en tareas-db:3306"
docker exec tareas-db mysql -uroot -p123456 -e "SELECT * FROM tareasdb.tareas;"
```

También: <http://localhost:3000/api/health> devuelve la versión de MySQL consultada desde la aplicación.

## API

| Método | Ruta                          | Descripción                    |
|--------|-------------------------------|--------------------------------|
| GET    | `/api/health`                 | Estado de la app y de la conexión con MySQL |
| GET    | `/api/tareas`                 | Lista las tareas               |
| POST   | `/api/tareas`                 | Crea una tarea `{ "titulo": "..." }` |
| PUT    | `/api/tareas/:id/completar`   | Marca o desmarca una tarea     |
| DELETE | `/api/tareas/:id`             | Elimina una tarea              |

## Pruebas

```bash
cd app
npm install
npm test
```

Las pruebas usan una base de datos simulada, así que no necesitan MySQL. Quedan listas para
el pipeline de integración continua de las siguientes entregas (Jenkins, Travis CI).

## Detener y limpiar

```bash
docker rm -f tareas-app tareas-db
docker network rm tareas-net
# o, si se usó Compose:
docker compose down
```

## Estructura

```
├── app/
│   ├── Dockerfile          # imagen de la aplicación
│   ├── package.json
│   ├── public/index.html   # interfaz web
│   ├── src/                # servidor Express y conexión a MySQL
│   └── test/               # pruebas de la API
├── docker-compose.yml
└── README.md
```

> La contraseña `123456` es solo para la práctica académica; no debe usarse en un entorno real.
