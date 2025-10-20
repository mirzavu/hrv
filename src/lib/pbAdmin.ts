import PocketBase from 'pocketbase';

let adminPb: PocketBase | null = null;

export async function getAdminPb(): Promise<PocketBase> {
  if (!adminPb) {
    adminPb = new PocketBase(process.env.PB_URL || 'http://127.0.0.1:8090');
  }

  const email = process.env.PB_ADMIN_EMAIL!;
  const password = process.env.PB_ADMIN_PASSWORD!;

  if (!email || !password) {
    throw new Error('Missing PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD environment variables');
  }

  // Re-authenticate if auth is invalid or expired
  if (!adminPb.authStore.isValid) {
    try {
      await adminPb.admins.authWithPassword(email, password);
    } catch (error) {
      console.error('PocketBase admin authentication failed:', error);
      throw error;
    }
  }

  return adminPb;
}

export default getAdminPb;