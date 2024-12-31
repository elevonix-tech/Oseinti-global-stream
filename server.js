const express = require('express'); 
const http = require('http'); 
const { Server } = require('socket.io'); 
const multer = require('multer'); 
const Stripe = require('stripe'); 
require('dotenv').config(); 
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const WebSocket = require('ws');
const cors = require('cors');

// Initialize Express App and Server 
const app = express(); 
const server = http.createServer(app); 
const io = new Server(server); 
 
// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(cookieParser());
app.use(express.static('public'));

// Database Connection
mongoose
.connect('mongodb://localhost:27017/oseintiStream', {
useNewUrlParser: true,
useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error(err));
// JWT Secret
const SECRET_KEY = 'your_secret_key';
 
// Multer Setup for File Uploads 
const storage = multer.diskStorage({ 
  destination: 'uploads/', 
  filename: (req, file, cb) => { 
    cb(null, `${Date.now()}-${file.originalname}`); 
  }, 
}); 
const upload = multer({ storage }); 
 
// Stripe Setup 
const stripe = Stripe(process.env.STRIPE_SECRET_KEY); 
 
// WebRTC Signaling 
const rooms = {}; 
io.on('connection', (socket) => { 
    console.log('User connected:', socket.id); 
   
    socket.on('join-room', (roomId, userId) => { 
      console.log(`User ${userId} joined room ${roomId}`); 
      if (!rooms[roomId]) rooms[roomId] = []; 
      rooms[roomId].push(userId); 
      socket.join(roomId); 
      socket.to(roomId).emit('user-connected', userId); 
   
      socket.on('signal', (data) => { 
        const { to, ...rest } = data; 
        socket.to(to).emit('signal', { from: socket.id, ...rest }); 
      }); 
   
      socket.on('disconnect', () => { 
        console.log(`User ${userId} disconnected from room ${roomId}`); 
        rooms[roomId] = rooms[roomId].filter((id) => id !== userId); 
        socket.to(roomId).emit('user-disconnected', userId); 
      }); 
    }); 
  }); 
   
  // Admin Video Upload Endpoint 
  app.post('/upload', upload.single('video'), (req, res) => { 
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' }); 
    res.status(200).json({ 
      message: 'Video uploaded successfully', 
      path: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`, 
    }); 
  }); 
io.on('connection', (socket) => { 
  console.log('User connected:', socket.id); 
 
  socket.on('join-room', (roomId, userId) => { 
    console.log(`User ${userId} joined room ${roomId}`); 
    if (!rooms[roomId]) rooms[roomId] = []; 
    rooms[roomId].push(userId); 
    socket.join(roomId); 
    socket.to(roomId).emit('user-connected', userId); 
 
    socket.on('signal', (data) => { 
      const { to, ...rest } = data; 
      socket.to(to).emit('signal', { from: socket.id, ...rest }); 
    }); 
 
    socket.on('disconnect', () => { 
      console.log(`User ${userId} disconnected from room ${roomId}`); 
      rooms[roomId] = rooms[roomId].filter((id) => id !== userId); 
      socket.to(roomId).emit('user-disconnected', userId); 
    }); 
  }); 
}); 
 
// Admin Video Upload Endpoint 
app.post('/upload', upload.single('video'), (req, res) => { 
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' }); 
  res.status(200).json({ 
    message: 'Video uploaded successfully', 
    path: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`, 
  }); 
}); 
// Stripe Payment Endpoints 
app.post('/donate', async (req, res) => { 
    const { amount, currency } = req.body; 
    try { 
      const paymentIntent = await stripe.paymentIntents.create({ 
        amount, 
        currency,
        payment_method_types: ['card'],
      });
      res.status(200).json({ clientSecret: paymentIntent.client_secret });
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});
app.post('/subscribe', async (req, res) => {
    const { email, plan } = req.body;
    try {
    const customer = await stripe.customers.create({ email });
    const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: plan }],
    });
    res.status(200).json({ subscription });
    } catch (err) {
    res.status(500).json({ error: err.message });
    }
   });
   // Register User
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    res.json({ message: 'Registration successful!' });
    });
    // Login User
    app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ message: 'Invalid credentials!' });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, SECRET_KEY, {
    expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true });
    res.json({ message: 'Login successful!' });
    });
    // Models
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' }, // 'admin' or 'user'
    }));
    const Session = mongoose.model('Session', new mongoose.Schema({
    sessionId: String,
    participants: [{ username: String, joinedAt: Date }],
}));

   // Start WebSocket for Sessions
const wss = new WebSocket.Server({ port: 8080 });
wss.on('connection', (ws) => {
ws.on('message', async (message) => {
const { sessionId, username } = JSON.parse(message);
const session = await Session.findOneAndUpdate(
{ sessionId },
{ $push: { participants: { username, joinedAt: new Date() } } },
{ upsert: true, new: true }
);
ws.send(JSON.stringify({ session }));
});
});
// Serve Landing Page
app.get('/', (req, res) => res.sendFile(__dirname +
'/public/index.html'));

   // Start the Server
   const PORT = process.env.PORT || 3000;
   server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
   });
   