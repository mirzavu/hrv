import PocketBase from 'pocketbase';

let adminPb: PocketBase | null = null;

export async function getAdminPb(): Promise<PocketBase> {
  if (!adminPb) {
    adminPb = new PocketBase(process.env.PB_URL || 'http://127.0.0.1:8091');
  }

  const email = process.env.PB_ADMIN_EMAIL!;
  const password = process.env.PB_ADMIN_PASSWORD!;

  if (!email || !password) {
    throw new Error('Missing PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD environment variables');
  }

  // Re-authenticate if auth is invalid or expired
  if (!adminPb.authStore.isValid) {
    try {
      // Try legacy admins API first (older PB versions)
      const anyPb = adminPb as unknown as { admins?: { authWithPassword?: (e: string, p: string) => Promise<unknown> } };
      if (anyPb.admins?.authWithPassword) {
        await anyPb.admins.authWithPassword(email, password);
      } else {
        // Fallback for PocketBase >= 0.30 where superusers live in a collection
        await adminPb.collection('_superusers').authWithPassword(email, password);
      }
    } catch (legacyErr) {
      // If legacy path failed (404 on new PB), try superusers collection
      try {
        await adminPb.collection('_superusers').authWithPassword(email, password);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('PocketBase admin authentication failed:', error);
        throw error;
      }
    }
  }

  return adminPb;
}

export default getAdminPb;