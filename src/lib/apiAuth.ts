import { NextRequest } from 'next/server';
import PocketBase from 'pocketbase';

/**
 * Verifies the 'Authorization' header and returns the authenticated user.
 * This ensures the Mobile App is actually logged in as the user it claims to be.
 */
export async function verifyAuth(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');

    // Create a temporary client just for verification
    // We use the public URL because we are acting as a client verifying a token
    const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090');

    if (!authHeader) {
        return null;
    }

    try {
        // Load the token into the store
        const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
        pb.authStore.save(token, null);

        // Verify the token with the server
        // This will throw if the token is invalid or expired
        const authData = await pb.collection('users').authRefresh();

        // Return the verified user record
        return authData.record;
    } catch (error) {
        console.warn('[Auth] Token verification failed:', error);
        return null;
    }
}
