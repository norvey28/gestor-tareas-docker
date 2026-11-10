const path = require('path');
const express = require('express');

// Recibe el pool de base de datos para poder probar la API sin MySQL real.
function crearApp(pool, infoDb = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Prueba de comunicacion entre contenedores: la app consulta a MySQL.
  app.get('/api/health', async (req, res) => {
    try {
      const [filas] = await pool.query('SELECT VERSION() AS version, NOW() AS hora');
      res.json({
        app: 'ok',
        baseDeDatos: 'conectada',
        hostDb: infoDb.host,
        versionMysql: filas[0].version,
        horaServidorDb: filas[0].hora,
      });
    } catch (error) {
      res.status(503).json({ app: 'ok', baseDeDatos: 'sin conexion', detalle: error.message });
    }
  });

  app.get('/api/tareas', async (req, res, next) => {
    try {
      const [filas] = await pool.query('SELECT id, titulo, completada, creada_en FROM tareas ORDER BY id');
      res.json(filas.map((f) => ({ ...f, completada: Boolean(f.completada) })));
    } catch (error) { next(error); }
  });

  app.post('/api/tareas', async (req, res, next) => {
    try {
      const titulo = typeof req.body.titulo === 'string' ? req.body.titulo.trim() : '';
      if (!titulo) return res.status(400).json({ error: 'El titulo es obligatorio' });
      if (titulo.length > 150) return res.status(400).json({ error: 'El titulo admite maximo 150 caracteres' });
      const [resultado] = await pool.query('INSERT INTO tareas (titulo) VALUES (?)', [titulo]);
      res.status(201).json({ id: resultado.insertId, titulo, completada: false });
    } catch (error) { next(error); }
  });

  app.put('/api/tareas/:id/completar', async (req, res, next) => {
    try {
      const [resultado] = await pool.query('UPDATE tareas SET completada = NOT completada WHERE id = ?', [req.params.id]);
      if (resultado.affectedRows === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
      res.json({ ok: true });
    } catch (error) { next(error); }
  });

  app.delete('/api/tareas/:id', async (req, res, next) => {
    try {
      const [resultado] = await pool.query('DELETE FROM tareas WHERE id = ?', [req.params.id]);
      if (resultado.affectedRows === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
      res.status(204).end();
    } catch (error) { next(error); }
  });

  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({ error: 'Error interno', detalle: error.message });
  });

  return app;
}

module.exports = { crearApp };
