import { neon } from '@neondatabase/serverless';

const url =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_UId3plXGQcZ7@ep-solitary-pond-ait77k2q-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = neon(url);

const confAntes = await sql`SELECT COUNT(*)::int AS n FROM confirmaciones`;
const famAntes = await sql`SELECT COUNT(*)::int AS n FROM familias`;

await sql`DELETE FROM confirmaciones`;
await sql`DELETE FROM familias`;

const confDespues = await sql`SELECT COUNT(*)::int AS n FROM confirmaciones`;
const famDespues = await sql`SELECT COUNT(*)::int AS n FROM familias`;

console.log(`Confirmaciones borradas: ${confAntes[0].n} (ahora: ${confDespues[0].n})`);
console.log(`Familias borradas: ${famAntes[0].n} (ahora: ${famDespues[0].n})`);
