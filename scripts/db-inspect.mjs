import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

async function showTable(table) {
  const q = `
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = $1
    ORDER BY ordinal_position;
  `;
  const { rows } = await pool.query(q, [table]);
  console.log(`\n=== ${table} ===`);
  console.table(rows);
}

await showTable('users');
await showTable('pets');
await showTable('addresses');
await showTable('pet_journal');

await pool.end();