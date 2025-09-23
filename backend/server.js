import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { Client, Account } from 'node-appwrite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- Appwrite Server Client Initialization ---
const appwriteClient = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

const account = new Account(appwriteClient);

// --- Middleware ---
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());

// --- Routes ---

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'HRV Backend API is running' });
});

/**
 * This endpoint is a server-side proxy to exchange the OAuth2 token.
 * It's needed to securely create a session without exposing an API key on the frontend.
 * The Appwrite Web SDK will call this endpoint after the user returns from Google.
 */
app.post('/api/auth/oauth2/exchange', async (req, res) => {
  try {
    // The Web SDK on the frontend will have already created the user.
    // We just need to create a session for them on the server to get the session cookie.
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Create a session for the user, which generates the necessary auth cookie
    const session = await account.createSession(userId);

    // The Appwrite SDK automatically sets the secure, http-only cookie on the response.
    // We just need to send a success message.
    res.json({ message: 'Session created successfully', session });

  } catch (error) {
    console.error('[AUTH ERROR] Failed to exchange token:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 HRV Backend server running on port ${PORT}`);
});