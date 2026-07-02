import { Pool } from 'pg';

async function main() {
  // Test different connection string formats
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('DATABASE_URL is not set!');
    process.exit(1);
  }

  console.log(
    'Testing connection with:',
    connectionString.substring(0, 60) + '...',
  );

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    const client = await pool.connect();
    console.log('✓ Connected to database successfully');

    const result = await client.query('SELECT NOW()');
    console.log('Database time:', result.rows[0].now);

    await client.query('SELECT COUNT(*) FROM users');
    console.log('✓ Can query users table');

    client.release();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
