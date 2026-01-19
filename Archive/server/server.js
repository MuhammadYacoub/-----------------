import express from 'express';
import cors from 'cors';
import path from 'path';

import applicationsRoutes from './routes/applications.js';
import dashboardRoutes from './routes/dashboard.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static('uploads'));

app.use('/applications', applicationsRoutes);
app.use('/dashboard', dashboardRoutes);

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
