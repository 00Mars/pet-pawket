// db/pgClient.js
import pkg from 'pg';
const { Client } = pkg;

export const pgClient = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'petpawket',
  password: '150YoRfHmV!33',
  port: 5432,
});

pgClient.connect().catch(err => {
  console.error('❌ PostgreSQL connection error:', err);
});