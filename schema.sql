-- Ejecuta esto en el SQL Editor de Neon (https://console.neon.tech)
-- o déjalo: la API crea la tabla automáticamente al primer uso.

CREATE TABLE IF NOT EXISTS confirmaciones (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  nombre_key VARCHAR(255) NOT NULL UNIQUE,
  asistencia VARCHAR(10) NOT NULL CHECK (asistencia IN ('Sí', 'No')),
  acompanantes INTEGER NOT NULL DEFAULT 0 CHECK (acompanantes >= 0 AND acompanantes <= 10),
  mensaje TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS confirmaciones_updated_at_idx ON confirmaciones (updated_at DESC);
