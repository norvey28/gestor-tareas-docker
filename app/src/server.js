const { crearApp } = require('./app');
const { config, conectar, inicializar } = require('./db');

const PUERTO = Number(process.env.PORT || 3000);

async function main() {
  const pool = await conectar();
  await inicializar(pool);
  crearApp(pool, config).listen(PUERTO, () => {
    console.log(`Gestor de tareas escuchando en http://localhost:${PUERTO}`);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
