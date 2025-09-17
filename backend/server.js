const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const PocketBase = require('pocketbase');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize PocketBase
const pb = new PocketBase(process.env.POCKETBASE_URL || 'http://127.0.0.1:8090');

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'HRV Backend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const authData = await pb.collection('users').authWithPassword(email, password);
    res.json({ user: authData.record, token: authData.token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const user = await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      name
    });
    res.json({ user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  pb.authStore.clear();
  res.json({ message: 'Logged out successfully' });
});

// Google OAuth endpoints
app.post('/api/auth/google', async (req, res) => {
  try {
    const { code } = req.body;
    const authData = await pb.collection('users').authWithOAuth2('google', code);
    res.json({ user: authData.record, token: authData.token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// HRV data endpoints
app.post('/api/hrv/session', async (req, res) => {
  try {
    const sessionData = await pb.collection('hrv_sessions').create(req.body);
    res.json(sessionData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/hrv/sessions', async (req, res) => {
  try {
    const sessions = await pb.collection('hrv_sessions').getList();
    res.json(sessions);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 HRV Backend server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🗄️ PocketBase URL: ${process.env.POCKETBASE_URL || 'http://127.0.0.1:8090'}`);
}); 