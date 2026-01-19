import sql from 'mssql';

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectionTimeout: 30000,
    requestTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let pool;

export async function getPool() {
  if (!pool) {
    console.log(`🔌 Connecting to DB at ${config.server}:${config.port} ...`);
    try {
      pool = await sql.connect(config);
      console.log('✅ SQL Server connected');
    } catch (err) {
      console.error(`❌ Connection Config: Host=${config.server}, Port=${config.port}, User=${config.user}`);
      throw err;
    }
  }
  return pool;
}

export { sql };
