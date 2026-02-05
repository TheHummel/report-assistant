'use server';

import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

/**
 * Ensure CERN user exists in auth.users table for database foreign keys
 * Uses service role to directly access auth schema
 */
export async function syncCernUser(): Promise<string | null> {
  const headersList = await headers();
  const cernEmail = headersList.get('x-forwarded-user');
  const cernUsername = headersList.get('x-forwarded-preferred-username');

  console.log('[syncCernUser] Headers:', { cernEmail, cernUsername });

  if (!cernEmail) {
    console.log('[syncCernUser] No CERN email, returning null');
    return null;
  }

  // Create service role client for auth schema access
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  console.log(
    '[syncCernUser] Using URL:',
    supabaseUrl,
    'Key length:',
    serviceRoleKey?.length
  );

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('[syncCernUser] Calling check_or_create_cern_user RPC');

  // Check if user exists using raw SQL - returns the UUID
  const { data: userId, error } = await supabase.rpc(
    'check_or_create_cern_user',
    {
      user_email: cernEmail,
      user_name: cernUsername || cernEmail.split('@')[0],
    }
  );

  if (error) {
    console.error('[syncCernUser] RPC error:', error);
    return null;
  }

  console.log(
    '[syncCernUser] User synced successfully:',
    cernEmail,
    'UUID:',
    userId
  );
  return userId; // Return the UUID from auth.users
}
