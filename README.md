# Gestor de tareas con Docker

Proyecto del módulo **Énfasis Profesional I (Integración Continua)** — Politécnico Grancolombiano.
- **Entrega 1 (semana 3):** dos contenedores Docker comunicados entre sí.
- **Entrega 2 (semana 5):** integración continua con Jenkins (pipeline en `Jenkinsfile`).

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

## Integración continua con Jenkins (entrega 2)

Jenkins corre en su propio contenedor y usa el Docker del equipo (socket montado) para probar,
construir y desplegar la aplicación. El pipeline está definido en el `Jenkinsfile`.

```
GitHub ──(pollSCM cada 5 min)──► Jenkins ──► Pruebas ──► Construir imagen ──► Desplegar ──► Verificar
                                 (contenedor)  (imagen test)  tareas-app:N       tareas-app + tareas-db
```

| Etapa | Qué hace |
|-------|----------|
| Checkout | Descarga el código del repositorio |
| Verificar herramientas | Comprueba que Jenkins puede usar Docker |
| Pruebas | Construye la imagen de pruebas, ejecuta `node --test` y publica el reporte JUnit |
| Construir imagen | Crea `tareas-app:<número de build>` y `tareas-app:latest` |
| Desplegar | Crea la red y la BD si no existen y reemplaza el contenedor `tareas-app` |
| Verificar despliegue | Consulta `/api/health` hasta confirmar la conexión con MySQL |

### Puesta en marcha

```bash
docker compose -f jenkins/docker-compose.yml up -d --build
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

1. Abrir <http://localhost:8080>, pegar la contraseña inicial, instalar los plugins sugeridos y crear el usuario administrador.
2. *Manage Jenkins → Credentials → System → Global credentials → Add Credentials*:
   tipo **Secret text**, ID **`mysql-password`**, valor `123456` (la misma contraseña de `tareas-db`).
3. *New Item* → nombre `gestor-tareas-pipeline` → tipo **Pipeline**.
   En *Pipeline*: **Pipeline script from SCM**, SCM **Git**, URL de este repositorio, rama `*/main`, Script Path `Jenkinsfile`.
4. **Build Now**. Desde el primer build, Jenkins revisa GitHub cada 5 minutos y ejecuta el pipeline con cada commit nuevo.

> El contenedor de Jenkins se ejecuta como root y con acceso al socket de Docker para simplificar
> el laboratorio. En un entorno real se usarían agentes dedicados y permisos mínimos.

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
# Jenkins:
docker compose -f jenkins/docker-compose.yml down
```

## Estructura

```
├── app/
│   ├── Dockerfile          # imagen de la aplicación (etapas test y produccion)
│   ├── package.json
│   ├── public/index.html   # interfaz web
│   ├── src/                # servidor Express y conexión a MySQL
│   └── test/               # pruebas de la API
├── jenkins/
│   ├── Dockerfile          # Jenkins LTS (Java 21) + cliente Docker
│   └── docker-compose.yml  # contenedor de Jenkins
├── Jenkinsfile             # pipeline de integración continua
├── docker-compose.yml
└── README.md
```

> La contraseña `123456` es solo para la práctica académica; no debe usarse en un entorno real.
