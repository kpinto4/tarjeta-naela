import { neon } from '@neondatabase/serverless';

const url =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_UId3plXGQcZ7@ep-solitary-pond-ait77k2q-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require';

const sql = neon(url);

const antes = await sql`SELECT COUNT(*)::int AS n FROM confirmaciones`;
await sql`DELETE FROM confirmaciones`;
const despues = await sql`SELECT COUNT(*)::int AS n FROM confirmaciones`;
const familias = await sql`SELECT COUNT(*)::int AS n FROM familias`;

console.log(`Confirmaciones borradas: ${antes[0].n}`);
console.log(`Confirmaciones ahora: ${despues[0].n}`);
console.log(`Familias conservadas: ${familias[0].n}`);
