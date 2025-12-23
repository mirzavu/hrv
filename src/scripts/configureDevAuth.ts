
import getAdminPb from '../lib/pbAdmin';

async function configureDevAuth() {
    console.log('Configuring PocketBase for Dev Auth...');
    const pb = await getAdminPb();

    try {
        // 1. Enable Email/Password Auth on 'users' collection
        console.log('Checking "users" collection config...');
        const collection = await pb.collections.getOne('users');

        // Check if password auth is enabled
        // Note: The specific field structure depends on PB version, but usually it's in `authOptions` or similar for recent versions, 
        // or implicitly enabled if specific auth providers are configured. 
        // Actually, for Email/Password, it is separate from OAuth2.
        // In PB < 0.23, it was `allowEmailAuth` and `allowPasswordAuth`.
        // In PB >= 0.23, it's `passwordAuth: { enabled: true }` etc.
        // Let's print the collection to debug if needed, but we'll try to update it blindly to "enabled".

        // Update collection to enable email/password auth
        // We'll update the collection structure to ensure password auth is allowed.
        // The error "The collection is not configured to allow password authentication" usually means 
        // the system setting (if any) or the collection specific setting is off.

        // In modern PocketBase, we update the collection.
        // "passwordAuth": { "enabled": true }

        // Let's just update the collection.
        await pb.collections.update('users', {
            passwordAuth: {
                enabled: true,
                identityFields: ['email']
            }
        });
        console.log('✅ Enabled Password Auth on "users" collection.');

        // 2. Ensure user exists
        const email = 'mirza.ekm@gmail.com';
        const password = 'changeme123';

        try {
            const user = await pb.collection('users').getFirstListItem(`email="${email}"`);
            console.log(`✅ User ${email} already exists (ID: ${user.id}). Updating password just in case...`);
            await pb.collection('users').update(user.id, {
                password: password,
                passwordConfirm: password,
                emailVisibility: true,
                verified: true
            });
        } catch (e: any) {
            if (e.status === 404) {
                console.log(`User ${email} not found. Creating...`);
                await pb.collection('users').create({
                    email: email,
                    password: password,
                    passwordConfirm: password,
                    name: 'Mirza (Dev)',
                    emailVisibility: true,
                    verified: true
                });
                console.log(`✅ Created user ${email}.`);
            } else {
                throw e;
            }
        }

        console.log('SUCCESS: Dev Auth Configured.');

    } catch (err) {
        console.error('FAILED to configure Dev Auth:', err);
        process.exit(1);
    }
}

configureDevAuth();
