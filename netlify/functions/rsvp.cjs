const { neon } = require('@neondatabase/serverless');

function env(name) {
  return process.env[name];
}

function getDatabaseUrl() {
  return (
    env('DATABASE_URL') ||
    env('NETLIFY_DATABASE_URL') ||
    'postgresql://neondb_owner:npg_UId3plXGQcZ7@ep-solitary-pond-ait77k2q-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require'
  );
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': env('ALLOWED_ORIGIN') || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

let sql;
let tableReady = false;

function getSql() {
  if (!sql) sql = neon(getDatabaseUrl());
  return sql;
}

async function ensureTable() {
  if (tableReady) return;
  const db = getSql();
  await db`
    CREATE TABLE IF NOT EXISTS confirmaciones (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      nombre_key VARCHAR(255) NOT NULL UNIQUE,
      familia VARCHAR(100) NOT NULL DEFAULT '',
      asistencia VARCHAR(10) NOT NULL CHECK (asistencia IN ('Sí', 'No')),
      acompanantes INTEGER NOT NULL DEFAULT 0,
      mensaje TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`ALTER TABLE confirmaciones ADD COLUMN IF NOT EXISTS familia VARCHAR(100) NOT NULL DEFAULT ''`;
  await db`ALTER TABLE confirmaciones ADD COLUMN IF NOT EXISTS personas INTEGER NOT NULL DEFAULT 0`;
  tableReady = true;
}

function parseBody(event) {
  let raw = event.body;
  if (!raw) return {};
  if (event.isBase64Encoded) {
    raw = Buffer.from(raw, 'base64').toString('utf8');
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

function validateEntry(data) {
  const nombre = String(data.nombre || '').trim();
  const familia = String(data.familia || '').trim();
  const asistencia = String(data.asistencia || '').trim();
  const mensaje = String(data.mensaje || '').trim();
  let personas = Number.parseInt(data.personas, 10);

  if (!nombre || nombre.length > 255) return { error: 'Nombre inválido' };
  if (!['Sí', 'No'].includes(asistencia)) return { error: 'Asistencia inválida' };
  if (asistencia === 'No') {
    personas = 0;
  } else {
    if (Number.isNaN(personas)) personas = 1;
    if (personas < 1 || personas > 20) return { error: 'Número de personas inválido' };
  }
  if (mensaje.length > 1000) return { error: 'Mensaje demasiado largo' };

  const nombre_key = familia ? `f:${familia}` : nombre.toLowerCase();

  return {
    entry: {
      nombre,
      nombre_key,
      familia,
      asistencia,
      personas,
      mensaje
    }
  };
}

function formatRow(row) {
  if (!row) return null;
  const personas = Number(row.personas) > 0
    ? Number(row.personas)
    : (row.asistencia === 'Sí' ? 1 + Number(row.acompanantes || 0) : 0);

  return {
    id: row.id,
    nombre: row.nombre,
    familia: row.familia || '',
    asistencia: row.asistencia,
    personas,
    mensaje: row.mensaje,
    fecha: new Date(row.updated_at || row.created_at).toLocaleString('es-CO', {
      timeZone: 'America/Bogota'
    })
  };
}

exports.handler = async (event) => {
  const headers = corsHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    const db = getSql();

    if (event.httpMethod === 'POST') {
      const { entry, error } = validateEntry(parseBody(event));
      if (error) {
        return { statusCode: 400, headers, body: JSON.stringify({ error }) };
      }

      const rows = await db`
        INSERT INTO confirmaciones (nombre, nombre_key, familia, asistencia, personas, mensaje)
        VALUES (${entry.nombre}, ${entry.nombre_key}, ${entry.familia}, ${entry.asistencia}, ${entry.personas}, ${entry.mensaje})
        ON CONFLICT (nombre_key) DO UPDATE SET
          nombre = EXCLUDED.nombre,
          familia = EXCLUDED.familia,
          asistencia = EXCLUDED.asistencia,
          personas = EXCLUDED.personas,
          mensaje = EXCLUDED.mensaje,
          updated_at = NOW()
        RETURNING id, nombre, familia, asistencia, personas, mensaje, created_at, updated_at
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data: formatRow(rows[0]) })
      };
    }

    await ensureTable();

    if (event.httpMethod === 'GET') {
      const rows = await db`
        SELECT id, nombre, familia, asistencia, personas, mensaje, created_at, updated_at
        FROM confirmaciones
        ORDER BY updated_at DESC
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data: rows.map(formatRow) })
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error del servidor', detail: err.message })
    };
  }
};
