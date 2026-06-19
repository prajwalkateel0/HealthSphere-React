require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

const staticAllowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5175',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
];

function isAllowedOrigin(origin) {
  if (!origin) return true; // non-browser requests (curl, server-to-server)
  if (staticAllowedOrigins.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    return hostname === 'powerapps.com' || hostname.endsWith('.powerapps.com');
  } catch {
    return false;
  }
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
};

const io = new Server(server, { cors: corsOptions });

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/patient', require('./routes/patient'));
app.use('/api/doctor', require('./routes/doctor'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/government', require('./routes/government'));
app.use('/api/medical-team', require('./routes/medicalTeam'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Socket.io for real-time chat
const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
    io.emit('online-users', Array.from(onlineUsers.keys()));
  });

  socket.on('send-message', (msg) => {
    const receiverSocketId = onlineUsers.get(String(msg.receiver_id));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('new-message', msg);
    }
  });

  socket.on('typing', ({ to }) => {
    const toSocket = onlineUsers.get(String(to));
    if (toSocket) io.to(toSocket).emit('typing', { from: socket.userId });
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      io.emit('online-users', Array.from(onlineUsers.keys()));
    }
  });
});

const PORT = process.env.PORT || 5002;
server.listen(PORT, () => console.log(`HealthSphere API running on port ${PORT}`));
