import { ensureTable, getSql } from '../lib/rsvp-core.js';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Falta DATABASE_URL. Ejemplo en PowerShell:');
    console.error('$env:DATABASE_URL="postgresql://..."; npm run db:init');
    process.exit(1);
  }

  const sql = getSql();
  await ensureTable(sql);
  const rows = await sql`SELECT COUNT(*)::int AS total FROM confirmaciones`;
  console.log('Tabla confirmaciones lista en Neon.');
  console.log(`Confirmaciones actuales: ${rows[0].total}`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
