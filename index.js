const path = require('path');
const { createServer } = require('http');
const express = require('express');
const socketIO = require('socket.io');

const app = express();
app.use('/', express.static(path.join(__dirname, 'static')));

const httpServer = createServer(app);
const port = process.env.PORT || 3500;

const io = socketIO(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store all active rooms
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Handle joining a room
  socket.on('join-room', ({ roomId, userId }) => {
    socket.join(roomId);
    
    // Initialize room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    
    // Add user to room
    rooms.get(roomId).add(userId);
    
    // Notify others in the room about new user
    socket.to(roomId).emit('user-connected', userId);
    
    // Send current participants to the new user
    const participants = Array.from(rooms.get(roomId)).filter(id => id !== userId);
    socket.emit('current-participants', participants);
  });

  // Handle WebRTC signaling
  socket.on('signal', ({ to, from, signal }) => {
    io.to(to).emit('signal', { from, signal });
  });

  // Handle leaving a room
  socket.on('leave-room', ({ roomId, userId }) => {
    if (rooms.has(roomId)) {
      rooms.get(roomId).delete(userId);
      
      // Clean up empty rooms
      if (rooms.get(roomId).size === 0) {
        rooms.delete(roomId);
      } else {
        // Notify others about user leaving
        socket.to(roomId).emit('user-disconnected', userId);
      }
    }
    socket.leave(roomId);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    // Handle cleanup for unexpected disconnections
  });
});

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
