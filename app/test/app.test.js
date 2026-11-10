// Pruebas de la API con una base de datos simulada (no requieren MySQL).
// Serviran en las siguientes entregas para el pipeline de integracion continua.
const test = require('node:test');
const assert = require('node:assert');
const { crearApp } = require('../src/app');

function poolFalso() {
  const tareas = [{ id: 1, titulo: 'Tarea inicial', completada: 0, creada_en: new Date() }];
  return {
    tareas,
    async query(sql, params = []) {
      if (sql.startsWith('SELECT VERSION')) return [[{ version: '8.4-falsa', hora: new Date() }]];
      if (sql.startsWith('SELECT id')) return [tareas];
      if (sql.startsWith('INSERT')) {
        const id = tareas.length + 1;
        tareas.push({ id, titulo: params[0], completada: 0, creada_en: new Date() });
        return [{ insertId: id }];
      }
      if (sql.startsWith('UPDATE')) {
        const t = tareas.find((x) => x.id === Number(params[0]));
        if (t) t.completada = t.completada ? 0 : 1;
        return [{ affectedRows: t ? 1 : 0 }];
      }
      if (sql.startsWith('DELETE')) {
        const i = tareas.findIndex((x) => x.id === Number(params[0]));
        if (i >= 0) tareas.splice(i, 1);
        return [{ affectedRows: i >= 0 ? 1 : 0 }];
      }
      throw new Error('Consulta no simulada: ' + sql);
    },
  };
}

async function conServidor(pool, fn) {
  const servidor = crearApp(pool, { host: 'falsa' }).listen(0);
  const base = `http://127.0.0.1:${servidor.address().port}`;
  try { await fn(base); } finally { servidor.close(); }
}

test('health informa que la base de datos esta conectada', async () => {
  await conServidor(poolFalso(), async (base) => {
    const r = await fetch(base + '/api/health');
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).baseDeDatos, 'conectada');
  });
});

test('health responde 503 si la base de datos no esta disponible', async () => {
  const pool = { query: async () => { throw new Error('ECONNREFUSED'); } };
  await conServidor(pool, async (base) => {
    const r = await fetch(base + '/api/health');
    assert.strictEqual(r.status, 503);
  });
});

test('lista, crea, completa y elimina tareas', async () => {
  const pool = poolFalso();
  await conServidor(pool, async (base) => {
    let r = await fetch(base + '/api/tareas');
    assert.strictEqual((await r.json()).length, 1);

    r = await fetch(base + '/api/tareas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: '  Nueva tarea  ' }),
    });
    assert.strictEqual(r.status, 201);
    const creada = await r.json();
    assert.strictEqual(creada.titulo, 'Nueva tarea');

    r = await fetch(`${base}/api/tareas/${creada.id}/completar`, { method: 'PUT' });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(pool.tareas.find((t) => t.id === creada.id).completada, 1);

    r = await fetch(`${base}/api/tareas/${creada.id}`, { method: 'DELETE' });
    assert.strictEqual(r.status, 204);
    assert.strictEqual(pool.tareas.length, 1);
  });
});

test('rechaza tareas sin titulo y tareas inexistentes', async () => {
  await conServidor(poolFalso(), async (base) => {
    let r = await fetch(base + '/api/tareas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titulo: '   ' }),
    });
    assert.strictEqual(r.status, 400);
    r = await fetch(base + '/api/tareas/999', { method: 'DELETE' });
    assert.strictEqual(r.status, 404);
  });
});
