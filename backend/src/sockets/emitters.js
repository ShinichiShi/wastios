const { Server } = require('socket.io');
const { env } = require('../config/env');
const { logger } = require('../middleware/logger');

let io = null;
let wsNamespace = null;

function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  wsNamespace = io.of('/ws');

  wsNamespace.on('connection', (socket) => {
    logger.info('WebSocket client connected', {
      socketId: socket.id,
      namespace: '/ws',
    });

    socket.on('disconnect', () => {
      logger.info('WebSocket client disconnected', {
        socketId: socket.id,
        namespace: '/ws',
      });
    });
  });

  return io;
}

function getNamespace() {
  return wsNamespace;
}

function emitBinUpdate({ bin_id, fill_level, timestamp }) {
  if (!wsNamespace) return;
  wsNamespace.emit('bin_update', { bin_id, fill_level, timestamp });
}

function emitClassificationUpdate({ bin_id, label, confidence, timestamp }) {
  if (!wsNamespace) return;
  wsNamespace.emit('classification_update', { bin_id, label, confidence, timestamp });
}

function emitBinAlert({ bin_id, fill_level }) {
  if (!wsNamespace) return;
  wsNamespace.emit('bin_alert', {
    bin_id,
    fill_level,
    message: `Bin ${bin_id} is almost full`,
  });
}

module.exports = {
  initSocketServer,
  getNamespace,
  emitBinUpdate,
  emitClassificationUpdate,
  emitBinAlert,
};
