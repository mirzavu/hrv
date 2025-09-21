import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import PocketBase from 'pocketbase';
import dotenv from 'dotenv';

dotenv.config();

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

// Middleware to verify authentication
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authentication token provided' });
    }

    const token = authHeader.substring(7);
    pb.authStore.save(token);

    if (!pb.authStore.isValid || !pb.authStore.model) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    req.user = pb.authStore.model;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// HRV data endpoints
app.post('/api/hrv/session', authenticateUser, async (req, res) => {
  try {
    const sessionData = await pb.collection('hrv_sessions').create({
      ...req.body,
      user: req.user.id
    });
    res.json(sessionData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/hrv/sessions', authenticateUser, async (req, res) => {
  try {
    const sessions = await pb.collection('hrv_sessions').getList(1, 50, {
      filter: `user = "${req.user.id}"`,
      sort: '-created'
    });
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