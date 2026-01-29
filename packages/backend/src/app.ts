import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { generalRateLimiter } from './middleware/rate-limit.middleware.js';
import {
  csrfProtection,
  csrfTokenEndpoint,
  csrfTokenGenerator,
} from './middleware/csrf.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.middleware.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import employeesRouter from './routes/employees.js';
import documentsRouter from './routes/documents.js';
import dashboardRouter from './routes/dashboard.js';
import taskCodesRouter from './routes/task-codes.js';
import timesheetsRouter from './routes/timesheets.js';
import supervisorRouter from './routes/supervisor.js';
import payrollRouter from './routes/payroll.js';
import reportsRouter from './routes/reports.js';

const app: Express = express();

// Trust proxy for rate limiting behind reverse proxy (Vercel)
app.set('trust proxy', 1);

// Security middleware with enhanced Helmet configuration
app.use(
  helmet({
    // Content Security Policy - restrict resource loading
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"], // Prevent clickjacking
        formAction: ["'self'"],
        upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
      },
    },
    // Strict Transport Security - enforce HTTPS (production only)
    strictTransportSecurity: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    // Prevent MIME type sniffing
    noSniff: true,
    // X-Frame-Options - prevent clickjacking
    frameguard: { action: 'deny' },
    // Hide X-Powered-By header
    hidePoweredBy: true,
    // XSS filter (legacy browsers)
    xssFilter: true,
    // Referrer Policy - control referrer info sent
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Cross-Origin policies
    crossOriginEmbedderPolicy: false, // Can cause issues with external resources
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  })
);

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

// Body parsing
app.use(express.json());

// Cookie parsing (required for CSRF)
app.use(cookieParser());

// General rate limiting for all API routes
app.use('/api', generalRateLimiter);

// CSRF token endpoint (must be before csrfProtection)
app.get('/api/csrf-token', csrfTokenGenerator, csrfTokenEndpoint);

// CSRF protection for state-changing requests
app.use('/api', csrfProtection);

// Routes
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/task-codes', taskCodesRouter);
app.use('/api/timesheets', timesheetsRouter);
app.use('/api/supervisor', supervisorRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/reports', reportsRouter);
// Document upload endpoint is nested under employees
app.use('/api', documentsRouter);

// 404 handler for unknown routes (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
