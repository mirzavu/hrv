import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import PocketBase from 'pocketbase';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const POCKETBASE_URL = process.env.POCKETBASE_URL;
const CORS_ORIGIN = process.env.CORS_ORIGIN;

// --- Extensive Logging Middleware ---
const requestLogger = (req, res, next) => {
  console.log('--------------------------------------------------');
  console.log(`[REQ LOG] TIME: ${new Date().toISOString()}`);
  console.log(`[REQ LOG] METHOD: ${req.method}, URL: ${req.originalUrl}`);
  console.log('[REQ LOG] HEADERS:', JSON.stringify(req.headers, null, 2));
  next();
};

console.log('--- SERVER INITIALIZATION ---');
console.log(`[CONFIG] PORT: ${PORT}`);
console.log(`[CONFIG] CORS_ORIGIN set to: ${CORS_ORIGIN}`);
console.log(`[CONFIG] POCKETBASE_URL set to: ${POCKETBASE_URL}`);
console.log('-----------------------------');

// Initialize PocketBase
const pb = new PocketBase(POCKETBASE_URL);

// --- CORS Configuration ---
const corsOptions = {
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// --- Middleware Setup ---
// 1. Log every single request right at the start
app.use(requestLogger);

// 2. Set up CORS with detailed logging
app.use((req, res, next) => {
  console.log(`[CORS] Applying CORS middleware for origin: ${CORS_ORIGIN}`);
  cors(corsOptions)(req, res, next);
});


// 3. Other standard middleware
app.use(helmet());
app.use(morgan('dev')); // Using 'dev' for more concise logs in this case
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --- ROUTES ---

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  console.log('[HEALTH] Health check endpoint hit.');
  res.json({
    status: 'OK',
    message: 'HRV Backend API is running',
  });
});

// Auth endpoints...
app.post('/api/auth/google', async (req, res) => {
  console.log('[AUTH] /api/auth/google endpoint hit.');
  // ... (rest of the auth logic is the same)
  try {
    const { code, codeVerifier } = req.body;
    if (!code) {
      console.error('[AUTH ERROR] No auth code received.');
      return res.status(400).json({ error: 'No authorization code provided.' });
    }
    // Use the PUBLIC URL for the redirect
    const redirectUrl = `${process.env.POCKETBASE_PUBLIC_URL}/api/oauth2-redirect`;
    const authData = await pb.collection('users').authWithOAuth2Code('google', code, codeVerifier, redirectUrl);
    console.log(`[AUTH SUCCESS] User ${authData.record.email} authenticated.`);
    res.cookie('auth_token', pb.authStore.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 3600000 });
    res.json({ user: authData.record, token: pb.authStore.token });
  } catch (error) {
    console.error('[AUTH ERROR] Google OAuth callback failed:', error);
    res.status(400).json({ error: error.message });
  }
});


// Middleware to verify authentication
const authenticateUser = async (req, res, next) => {
  console.log('[AUTH MIDDLEWARE] Verifying user token...');
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
       console.log('[AUTH MIDDLEWARE] FAIL: No valid auth token provided.');
      return res.status(401).json({ error: 'No valid authentication token provided' });
    }
    const token = authHeader.substring(7);
    pb.authStore.save(token, null);
    const authRefresh = await pb.collection('users').authRefresh();
    console.log(`[AUTH MIDDLEWARE] SUCCESS: Token refreshed for user: ${authRefresh.record.id}`);
    req.user = pb.authStore.model;
    next();
  } catch (error) {
    console.error('[AUTH MIDDLEWARE] FAIL:', error.message);
    pb.authStore.clear();
    res.status(401).json({ error: 'Authentication failed', details: error.message });
  }
};

// HRV data endpoints
app.post('/api/hrv/session', authenticateUser, async (req, res) => {
  console.log(`[SESSION] /api/hrv/session POST endpoint hit for user: ${req.user.id}`);
  try {
    const sessionData = await pb.collection('hrv_sessions').create({
      ...req.body,
      user: req.user.id
    });
    console.log(`[SESSION] Successfully created session record: ${sessionData.id}`);
    res.status(201).json(sessionData);
  } catch (error) {
    console.error(`[SESSION ERROR] Failed to create session:`, error);
    res.status(400).json({ error: error.message });
  }
});

// ... (GET sessions endpoint, error handlers, and app.listen are the same)

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

app.listen(PORT, () => {
  console.log(`🚀 HRV Backend server running on port ${PORT}`);
});