import { neon } from '@neondatabase/serverless';

// Acceso dinámico: esbuild en Netlify no debe inyectar undefined en build time
function env(name) {
  return process.env[name];
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Pin',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

function getSql() {
  const databaseUrl = env('DATABASE_URL');
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no configurada');
  }
  return neon(databaseUrl);
}

export { getSql };

export async function ensureTable(sql = getSql()) {
  await sql`
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

  if (!nombre || nombre.length > 255) {
    return { error: 'Nombre inválido' };
  }
  if (!['Sí', 'No'].includes(asistencia)) {
    return { error: 'Asistencia inválida' };
  }
  if (Number.isNaN(acompanantes)) acompanantes = 0;
  if (asistencia === 'No') acompanantes = 0;
  if (acompanantes < 0 || acompanantes > 10) {
    return { error: 'Número de acompañantes inválido' };
  }
  if (mensaje.length > 1000) {
    return { error: 'Mensaje demasiado largo' };
  }

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
  const fecha = new Date(row.updated_at || row.created_at).toLocaleString('es-CO', {
    timeZone: 'America/Bogota'
  });

  return {
    id: row.id,
    nombre: row.nombre,
    asistencia: row.asistencia,
    acompanantes: row.acompanantes,
    mensaje: row.mensaje,
    fecha
  };
}

export async function handleRsvpRequest({ method, body, adminPinHeader }) {
  const origin = env('ALLOWED_ORIGIN') || '*';
  const headers = corsHeaders(origin);
  const sql = getSql();

  await ensureTable(sql);

  if (method === 'POST') {
    const { entry, error } = validateEntry(parseBody(body));
    if (error) {
      return { statusCode: 400, headers, body: JSON.stringify({ error }) };
    }

    const rows = await sql`
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

  if (method === 'GET') {
    const pinRequired = env('ADMIN_PIN');
    if (pinRequired && adminPinHeader !== pinRequired) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'PIN incorrecto' }) };
    }

    const rows = await sql`
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

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Método no permitido' })
  };
}
