const compression = require('compression');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const http = require('http');

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

// API routes
app.use('/api/sensor-data', sensorRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/analytics', analyticsRoutes);

// 404 + error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = { app, httpServer, io };
