import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import applicationsRoutes from './routes/applications.js';
import dashboardRoutes from './routes/dashboard.js';
import authRoutes from './routes/auth.js';

const app = express();

/* ===============================
   Fix __dirname with ES Modules
================================ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===============================
   Middlewares
================================ */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===============================
   Static folders
================================ */
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ===============================
   Routes
================================ */
app.use('/applications', applicationsRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/auth', authRoutes);

/* ===============================
   Health check (important)
================================ */
app.get('/health', (req, res) => {
   res.json({ status: 'ok', time: new Date() });
});

/* ===============================
   Server listen (SAFE)
================================ */
const PORT = process.env.PORT || 3003;

import { initializeDatabase } from './db_init.js';

initializeDatabase().then(() => {
   app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
   });
});
