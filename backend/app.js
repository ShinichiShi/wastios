const compression = require('compression');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const http = require('http');
const promClient = require('prom-client');

const { env } = require('./src/config/env');
const sensorRoutes = require('./src/routes/sensor');
const imageRoutes = require('./src/routes/image');
const analyticsRoutes = require('./src/routes/analytics');
const { requestContext, requestLogger } = require('./src/middleware/logger');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { initSocketServer } = require('./src/sockets/emitters');

const app = express();
const httpServer = http.createServer(app);
const io = initSocketServer(httpServer);

const metricsRegistry = new promClient.Registry();
promClient.collectDefaultMetrics({ register: metricsRegistry });
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [metricsRegistry],
});

const corsOrigin = env.FRONTEND_URL === '*' ? true : env.FRONTEND_URL;

// Security and performance middleware
app.use(helmet());
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestContext);
app.use(requestLogger);

// Health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Prometheus metrics
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.path, status_code: res.statusCode });
  });
  next();
});
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

// API routes
app.use('/api/sensor-data', sensorRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/analytics', analyticsRoutes);

// 404 + error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app, httpServer, io };
