import express from 'express';
import { pool, sql } from '../db.js';

const router = express.Router();

/* List applications */
router.get('/applications', async (req, res) => {
  const result = await pool.request()
    .query(`
      SELECT Id, FullName, NationalId, JobType, Status, CreatedAt
      FROM Applications
      ORDER BY CreatedAt DESC
    `);

  res.json(result.recordset);
});

/* Update status */
router.post('/applications/:id/status', async (req, res) => {
  await pool.request()
    .input('Id', sql.Int, req.params.id)
    .input('Status', sql.NVarChar, req.body.status)
    .query(`
      UPDATE Applications
      SET Status = @Status, UpdatedAt = SYSDATETIME()
      WHERE Id = @Id
    `);

  res.json({ success: true });
});

export default router;
