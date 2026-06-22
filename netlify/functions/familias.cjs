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
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
    CREATE TABLE IF NOT EXISTS familias (
      id VARCHAR(100) PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      saludo VARCHAR(255) NOT NULL,
      max_personas INTEGER NOT NULL DEFAULT 4 CHECK (max_personas >= 1 AND max_personas <= 20),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await db`ALTER TABLE familias ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20) NOT NULL DEFAULT ''`;
}

function normalizeWhatsApp(num) {
  const digits = String(num || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 && digits.startsWith('3')) return '57' + digits;
  return digits;
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

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function formatFamilia(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    saludo: row.saludo,
    maxPersonas: row.max_personas,
    whatsapp: row.whatsapp || ''
  };
}

function validateFamilia(data) {
  const nombre = String(data.nombre || '').trim();
  let saludo = String(data.saludo || '').trim();
  let id = String(data.id || '').trim();
  let maxPersonas = Number.parseInt(data.maxPersonas, 10);
  const whatsapp = normalizeWhatsApp(data.whatsapp);

  if (!nombre || nombre.length > 255) return { error: 'Nombre de familia inválido' };
  if (!saludo) saludo = `Querida ${nombre}`;
  if (saludo.length > 255) return { error: 'Saludo demasiado largo' };
  if (!id) id = slugify(nombre);
  if (!id) return { error: 'No se pudo generar el ID del enlace' };
  if (Number.isNaN(maxPersonas)) maxPersonas = 4;
  if (maxPersonas < 1 || maxPersonas > 20) return { error: 'Personas debe ser entre 1 y 20' };
  if (whatsapp && whatsapp.length < 10) return { error: 'WhatsApp inválido (ej. 3001234567)' };

  return { familia: { id, nombre, saludo, maxPersonas, whatsapp } };
}

exports.handler = async (event) => {
  const headers = corsHeaders();

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  try {
    await ensureTable();
    const db = getSql();

    if (event.httpMethod === 'GET') {
      const rows = await db`
        SELECT id, nombre, saludo, max_personas, whatsapp, created_at
        FROM familias
        ORDER BY nombre ASC
      `;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data: rows.map(formatFamilia) })
      };
    }

    if (event.httpMethod === 'POST') {
      const { familia, error } = validateFamilia(parseBody(event.body));
      if (error) {
        return { statusCode: 400, headers, body: JSON.stringify({ error }) };
      }

      const rows = await db`
        INSERT INTO familias (id, nombre, saludo, max_personas, whatsapp)
        VALUES (${familia.id}, ${familia.nombre}, ${familia.saludo}, ${familia.maxPersonas}, ${familia.whatsapp})
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre,
          saludo = EXCLUDED.saludo,
          max_personas = EXCLUDED.max_personas,
          whatsapp = EXCLUDED.whatsapp
        RETURNING id, nombre, saludo, max_personas, whatsapp
      `;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data: formatFamilia(rows[0]) })
      };
    }

    if (event.httpMethod === 'DELETE') {
      const data = parseBody(event.body);
      const id = event.queryStringParameters?.id || data.id;
      if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID requerido' }) };
      }

      await db`DELETE FROM familias WHERE id = ${id}`;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
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
