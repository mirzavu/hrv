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
const pb = new PocketBase(process.env.POCKETBASE_URL);

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
  console.log('[BACKEND DEBUG] authenticateUser middleware triggered.');
  try {
    const authHeader = req.headers.authorization;
    console.log('[BACKEND DEBUG] Authorization Header received:', authHeader);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[BACKEND DEBUG] No valid auth token provided.');
      return res.status(401).json({ error: 'No valid authentication token provided' });
    }

    const token = authHeader.substring(7);
    console.log('[BACKEND DEBUG] Token extracted:', token.substring(0, 20) + '...');

    // Set the token for the PocketBase JS SDK instance
    pb.authStore.save(token, null);

    console.log('[BACKEND DEBUG] Auth store isValid before refresh:', pb.authStore.isValid);
    console.log('[BACKEND DEBUG] Auth store model before refresh:', pb.authStore.model);

    // Actively verify and refresh the token against the PocketBase server
    try {
        const authRefresh = await pb.collection('users').authRefresh();
        console.log('[BACKEND DEBUG] Auth refresh successful for user:', authRefresh.record.id);
    } catch(e) {
        console.error('[BACKEND DEBUG] Auth refresh failed:', e.message);
        pb.authStore.clear(); // Clear invalid token
        return res.status(401).json({ error: 'Invalid authentication token', details: e.message });
    }

    if (!pb.authStore.isValid || !pb.authStore.model) {
      console.log('[BACKEND DEBUG] Auth store is still invalid after refresh attempt.');
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    console.log('[BACKEND DEBUG] Authentication successful for user:', pb.authStore.model.id);
    req.user = pb.authStore.model;
    next();
  } catch (error) {
    console.error('[BACKEND DEBUG] Authentication middleware failed with error:', error);
    pb.authStore.clear();
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
  console.log(`🗄️ PocketBase URL: ${process.env.POCKETBASE_URL}`);
}); 