import express from 'express';
import { getPool, sql } from '../db.js';

const router = express.Router();

/* List applications */
router.get('/applications', async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .query(`
        SELECT Id, FullName, NationalId, JobType, Status, CreatedAt,
               Governorate, Qualification, Phone, MilitaryStatus, BirthDate
        FROM Applications
        ORDER BY CreatedAt DESC
      `);

    res.json(result.recordset);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

/* Update status */
router.post('/applications/:id/status', async (req, res) => {
  try {
    const pool = await getPool();

    await pool.request()
      .input('Id', sql.Int, req.params.id)
      .input('Status', sql.NVarChar, req.body.status)
      .query(`
        UPDATE Applications
        SET Status = @Status, UpdatedAt = SYSDATETIME()
        WHERE Id = @Id
      `);

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

export default router;
