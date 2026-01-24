import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import employeesRouter from './routes/employees.js';
import documentsRouter from './routes/documents.js';
import dashboardRouter from './routes/dashboard.js';
import taskCodesRouter from './routes/task-codes.js';
import timesheetsRouter from './routes/timesheets.js';
import supervisorRouter from './routes/supervisor.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

// Body parsing
app.use(express.json());

// Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/task-codes', taskCodesRouter);
app.use('/api/timesheets', timesheetsRouter);
app.use('/api/supervisor', supervisorRouter);
// Document upload endpoint is nested under employees
app.use('/api', documentsRouter);

export default app;
