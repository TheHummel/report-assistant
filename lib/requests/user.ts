import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';
import { syncCernUser } from '@/lib/auth/sync-cern-user';

/**
 * Get current user from auth headers (production) or Supabase auth (local dev)
 */
export const getCurrentUser = async (): Promise<User | null> => {
  const headersList = await headers();

  // Check for SSO headers (production on OKD)
  const ssoEmail = headersList.get('x-forwarded-user');
  const ssoUsername = headersList.get('x-forwarded-preferred-username');

  console.log('[getCurrentUser] SSO headers:', { ssoEmail, ssoUsername });

  if (ssoEmail) {
    // Ensure user exists in database and get the UUID
    const userId = await syncCernUser();

    if (!userId) {
      console.error('[getCurrentUser] Failed to sync SSO user');
      return null;
    }

    // Create User object from SSO headers with proper UUID
    const user = {
      id: userId, // Use the UUID from auth.users table
      email: ssoEmail,
      user_metadata: {
        name: ssoUsername || ssoEmail.split('@')[0],
        preferred_username: ssoUsername,
      },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as User;

    console.log(
      '[getCurrentUser] Returning SSO user:',
      user.email,
      'with ID:',
      userId
    );
    return user;
  }

  console.log('[getCurrentUser] No SSO headers, trying Supabase auth');

  // Fallback to Supabase auth (for local development)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log('[getCurrentUser] Supabase user:', user?.email || 'null');
  return user;
};
