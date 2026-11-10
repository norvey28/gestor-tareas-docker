// Conexion a MySQL. El host es el NOMBRE del contenedor de base de datos:
// Docker resuelve ese nombre dentro de la red compartida por ambos contenedores.
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'tareas-db',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'tareasdb',
};

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// MySQL tarda unos segundos en arrancar; se reintenta hasta que acepte conexiones.
async function conectar({ intentos = 30, pausaMs = 2000 } = {}) {
  for (let i = 1; i <= intentos; i++) {
    try {
      const pool = mysql.createPool({ ...config, waitForConnections: true, connectionLimit: 5 });
      await pool.query('SELECT 1');
      console.log(`Conectado a MySQL en ${config.host}:${config.port} (base ${config.database})`);
      return pool;
    } catch (error) {
      console.log(`MySQL aun no responde (intento ${i}/${intentos}): ${error.code || error.message}`);
      await esperar(pausaMs);
    }
  }
  throw new Error(`No fue posible conectar con MySQL en ${config.host}:${config.port}`);
}

// Crea la tabla y unas tareas de ejemplo la primera vez.
async function inicializar(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tareas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      titulo VARCHAR(150) NOT NULL,
      completada BOOLEAN NOT NULL DEFAULT FALSE,
      creada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4
  `);
  const [filas] = await pool.query('SELECT COUNT(*) AS total FROM tareas');
  if (filas[0].total === 0) {
    await pool.query('INSERT INTO tareas (titulo, completada) VALUES (?, ?), (?, ?), (?, ?)', [
      'Crear el repositorio en GitHub', true,
      'Instalar Docker Desktop', true,
      'Comunicar los dos contenedores', false,
    ]);
  }
}

module.exports = { config, conectar, inicializar };
