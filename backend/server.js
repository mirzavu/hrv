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
 * OAuth2 exchange endpoint - REMOVED
 * The Appwrite client-side SDK handles OAuth sessions automatically.
 * No server-side session creation is needed for the current implementation.
 * 
 * If server-side authentication is needed in the future, consider using:
 * - account.createJWT() to create JWT tokens for server-side API calls
 * - Proper session management with secrets
 */

// Example endpoint for future server-side operations (currently unused)
// app.post('/api/auth/jwt', async (req, res) => {
//   try {
//     const { userId } = req.body;
//     const jwt = await account.createJWT();
//     res.json({ jwt });
//   } catch (error) {
//     console.error('[AUTH ERROR] Failed to create JWT:', error);
//     res.status(500).json({ error: 'Failed to create JWT' });
//   }
// });

app.listen(PORT, () => {
  console.log(`🚀 HRV Backend server running on port ${PORT}`);
});