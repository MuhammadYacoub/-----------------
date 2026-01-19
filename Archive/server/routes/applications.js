import express from 'express';
import { pool, sql } from '../db.js';
import multer from 'multer';

const router = express.Router();

/* Upload config */
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

/* Submit application */
router.post('/submit', async (req, res) => {
  const {
    jobType, fullName, nationalId, email, phone,
    birthDate, governorate, qualification,
    educationEntity, graduationYear
  } = req.body;

  const result = await pool.request()
    .input('JobType', sql.NVarChar, jobType)
    .input('FullName', sql.NVarChar, fullName)
    .input('NationalId', sql.Char, nationalId)
    .input('Email', sql.NVarChar, email)
    .input('Phone', sql.NVarChar, phone)
    .input('BirthDate', sql.Date, birthDate)
    .input('Governorate', sql.NVarChar, governorate)
    .input('Qualification', sql.NVarChar, qualification)
    .input('EducationEntity', sql.NVarChar, educationEntity)
    .input('GraduationYear', sql.Int, graduationYear)
    .query(`
      INSERT INTO Applications
      (JobType, FullName, NationalId, Email, Phone, BirthDate,
       Governorate, Qualification, EducationEntity, GraduationYear)
      OUTPUT INSERTED.Id
      VALUES
      (@JobType, @FullName, @NationalId, @Email, @Phone, @BirthDate,
       @Governorate, @Qualification, @EducationEntity, @GraduationYear)
    `);

  res.json({ applicationId: result.recordset[0].Id });
});

/* Upload PDF */
router.post('/:id/upload', upload.single('file'), async (req, res) => {
  await pool.request()
    .input('ApplicationId', sql.Int, req.params.id)
    .input('FilePath', sql.NVarChar, req.file.path)
    .input('UploadedBy', sql.NVarChar, 'Applicant')
    .query(`
      INSERT INTO Documents (ApplicationId, FilePath, UploadedBy)
      VALUES (@ApplicationId, @FilePath, @UploadedBy)
    `);

  res.json({ success: true });
});

export default router;
