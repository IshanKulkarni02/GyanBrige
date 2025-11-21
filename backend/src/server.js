require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');
const os = require('os');

const videoRoutes = require('./routes/videoRoutes');
const notesRoutes = require('./routes/notesRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve static video files
app.use('/videos', express.static('public/videos'));

// MongoDB connection with instant sync
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB');
  // Enable change streams for real-time sync
  setupChangeStreams();
})
.catch(err => console.error('❌ MongoDB connection error:', err));

// Setup real-time sync with MongoDB change streams
function setupChangeStreams() {
  const db = mongoose.connection.db;
  const changeStream = db.watch();
  
  changeStream.on('change', (change) => {
    console.log('Database change detected:', change.operationType);
    // Broadcast changes to all connected clients
    io.emit('dbChange', change);
  });
}

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'GyanBrige Backend is running - Your personal bridge to learning',
    network: getNetworkAddresses()
  });
});

// Get local network addresses for LAN access
function getNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          interface: name,
          address: iface.address
        });
      }
    }
  }
  
  return addresses;
}

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log('\n📡 Access from LAN using:');
  getNetworkAddresses().forEach(addr => {
    console.log(`   http://${addr.address}:${PORT}`);
  });
});
