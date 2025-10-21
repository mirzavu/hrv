import PocketBase from 'pocketbase';

const url = typeof window === 'undefined'
  ? (process.env.PB_URL || process.env.NEXT_PUBLIC_PB_URL || 'http://127.0.0.1:8091')
  : (process.env.NEXT_PUBLIC_PB_URL || 'http://127.0.0.1:8091');

export const pb = new PocketBase(url);

// Enable auto cancellation of pending requests on auth store changes
pb.autoCancellation(false);

// Optional: persist auth state between browser sessions
if (typeof window !== 'undefined') {
  pb.authStore.onChange(() => {
    // Auth state changed - could trigger UI updates here if needed
  });
}

export default pb;