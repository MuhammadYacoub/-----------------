import sql from 'mssql';

const config = {
  user: 'db_user',
  password: 'db_password',
  server: 'localhost',
  database: 'RecruitmentPortal',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

export const pool = await sql.connect(config);
export { sql };
