import { getPool } from './db.js';

export async function initializeDatabase() {
    try {
        const pool = await getPool();
        console.log('🔄 Initializing Database Schema...');

        // 1. Ensure Table Exists (Basic Structure)
        // If table doesn't exist, create it with all modern columns
        const tableCheck = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Applications'");
        if (tableCheck.recordset.length === 0) {
            console.log('Creating Applications table...');
            await pool.request().query(`
        CREATE TABLE Applications (
          Id INT IDENTITY(1,1) PRIMARY KEY,
          JobType NVARCHAR(50) NOT NULL,
          FullName NVARCHAR(255) NOT NULL,
          NationalId CHAR(14) NOT NULL,
          Email NVARCHAR(255) NOT NULL,
          Phone NVARCHAR(20) NOT NULL,
          Governorate NVARCHAR(50),
          Qualification NVARCHAR(100),
          EducationEntity NVARCHAR(100),
          GraduationYear INT,
          BirthDate DATE,
          Address NVARCHAR(255),
          PreviousWork NVARCHAR(255),
          ExperienceYears INT,
          PreviousTasks NVARCHAR(MAX),
          Skills NVARCHAR(MAX),
          ExtraData NVARCHAR(MAX),
          FilePath NVARCHAR(255),
          ProfileImagePath NVARCHAR(255),
          MilitaryStatus NVARCHAR(50),
          Status NVARCHAR(50) DEFAULT 'Submitted',
          CreatedAt DATETIME DEFAULT GETDATE(),
          UpdatedAt DATETIME,
          IsLocked BIT DEFAULT 0
        )
      `);
            console.log('✅ Applications table created.');
        }

        // 1.5 Ensure OTP_Codes Table Exists
        const otpTableCheck = await pool.request().query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'OTP_Codes'");
        if (otpTableCheck.recordset.length === 0) {
            console.log('Creating OTP_Codes table...');
            await pool.request().query(`
                CREATE TABLE OTP_Codes (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    Email NVARCHAR(255) NOT NULL,
                    Code CHAR(6) NOT NULL,
                    CreatedAt DATETIME DEFAULT GETDATE(),
                    ExpiresAt DATETIME NOT NULL,
                    IsUsed BIT DEFAULT 0
                )
            `);
            console.log('✅ OTP_Codes table created.');
        } else {
            // 2. Schema Evolution (Add Missing Columns idempotently)
            const columnsToAdd = [
                "Address NVARCHAR(255)",
                "PreviousWork NVARCHAR(255)",
                "ExperienceYears INT",
                "PreviousTasks NVARCHAR(MAX)",
                "Skills NVARCHAR(MAX)",
                "ExtraData NVARCHAR(MAX)",
                "FilePath NVARCHAR(255)",
                "ProfileImagePath NVARCHAR(255)",
                "MilitaryStatus NVARCHAR(50)",
                "Status NVARCHAR(50) DEFAULT 'Submitted'",
                "BirthDate DATE",
                "Qualification NVARCHAR(100)",
                "Governorate NVARCHAR(50)",
                "Phone NVARCHAR(20)",
                "Gender NVARCHAR(20)",
                "Password NVARCHAR(255)",
                "PasswordSetAt DATETIME"
            ];

            for (const colDef of columnsToAdd) {
                const colName = colDef.split(' ')[0];
                try {
                    await pool.request().query(`ALTER TABLE Applications ADD ${colDef}`);
                    console.log(`➕ Added column: ${colName}`);
                } catch (e) {
                    if (e.number === 2705) {
                        // Column already exists, ignore
                    } else {
                        console.error(`❌ Failed to add ${colName}:`, e.message);
                    }
                }
            }
        }



        // 3. Drop Old Constraints (UQ_NationalId if exists)
        try {
            await pool.request().query("ALTER TABLE Applications DROP CONSTRAINT UQ_NationalId");
            console.log('➖ Dropped legacy constraint: UQ_NationalId');
        } catch (e) {
            if (e.number !== 3728 && !e.message.includes('not find')) {
                console.error('⚠️ Warning dropping constraint:', e.message);
            }
        }

        // 4. Duplicate Cleanup (Run once on start)
        console.log('🧹 Cleaning up duplicates...');
        const cleanupQuery = `
      WITH CTE AS (
          SELECT 
              Id, 
              NationalId, 
              JobType,
              ROW_NUMBER() OVER (
                  PARTITION BY NationalId, JobType 
                  ORDER BY CreatedAt DESC
              ) AS RowNum
          FROM Applications
      )
      DELETE FROM CTE WHERE RowNum > 1;
    `;
        const cleanupResult = await pool.request().query(cleanupQuery);
        if (cleanupResult.rowsAffected[0] > 0) {
            console.log(`✅ Removed ${cleanupResult.rowsAffected[0]} duplicate records.`);
        }

        console.log('✅ Database Initialization Complete.');

    } catch (err) {
        console.error('❌ Database Initialization Failed:', err);
        process.exit(1);
    }
}
