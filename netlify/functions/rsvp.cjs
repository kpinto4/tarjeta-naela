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

function getSql() {
  if (!sql) sql = neon(getDatabaseUrl());
  return sql;
}

async function ensureTable() {
  const db = getSql();
  await db`
    CREATE TABLE IF NOT EXISTS confirmaciones (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      nombre_key VARCHAR(255) NOT NULL UNIQUE,
      asistencia VARCHAR(10) NOT NULL CHECK (asistencia IN ('Sí', 'No')),
      acompanantes INTEGER NOT NULL DEFAULT 0 CHECK (acompanantes >= 0 AND acompanantes <= 10),
      mensaje TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function validateEntry(data) {
  const nombre = String(data.nombre || '').trim();
  const asistencia = String(data.asistencia || '').trim();
  const mensaje = String(data.mensaje || '').trim();
  let acompanantes = Number.parseInt(data.acompanantes, 10);

  if (!nombre || nombre.length > 255) return { error: 'Nombre inválido' };
  if (!['Sí', 'No'].includes(asistencia)) return { error: 'Asistencia inválida' };
  if (Number.isNaN(acompanantes)) acompanantes = 0;
  if (asistencia === 'No') acompanantes = 0;
  if (acompanantes < 0 || acompanantes > 10) return { error: 'Número de acompañantes inválido' };
  if (mensaje.length > 1000) return { error: 'Mensaje demasiado largo' };

  return {
    entry: {
      nombre,
      nombre_key: nombre.toLowerCase(),
      asistencia,
      acompanantes,
      mensaje
    }
  };
}

function formatRow(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    asistencia: row.asistencia,
    acompanantes: row.acompanantes,
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
    await ensureTable();
    const db = getSql();

    if (event.httpMethod === 'POST') {
      const { entry, error } = validateEntry(parseBody(event.body));
      if (error) {
        return { statusCode: 400, headers, body: JSON.stringify({ error }) };
      }

      const rows = await db`
        INSERT INTO confirmaciones (nombre, nombre_key, asistencia, acompanantes, mensaje)
        VALUES (${entry.nombre}, ${entry.nombre_key}, ${entry.asistencia}, ${entry.acompanantes}, ${entry.mensaje})
        ON CONFLICT (nombre_key) DO UPDATE SET
          nombre = EXCLUDED.nombre,
          asistencia = EXCLUDED.asistencia,
          acompanantes = EXCLUDED.acompanantes,
          mensaje = EXCLUDED.mensaje,
          updated_at = NOW()
        RETURNING id, nombre, asistencia, acompanantes, mensaje, created_at, updated_at
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data: formatRow(rows[0]) })
      };
    }

    if (event.httpMethod === 'GET') {
      const rows = await db`
        SELECT id, nombre, asistencia, acompanantes, mensaje, created_at, updated_at
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
