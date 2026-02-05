import { Database } from '@/database.types';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

/**
 * Create a service role client for SSO authenticated users.
 * This bypasses RLS since SSO users don't have Supabase JWT sessions.
 * Only use this for authenticated operations where getCurrentUser() returned a valid user.
 */
export async function createServiceClient() {
  const headersList = await headers();
  const ssoEmail = headersList.get('x-forwarded-user');

  // Only allow service client for SSO authenticated users
  if (!ssoEmail) {
    throw new Error(
      'Service client only available for SSO authenticated users'
    );
  }

  // Use direct VM URL for service role (not proxied)
  const serviceUrl =
    process.env.SUPABASE_SERVICE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return createSupabaseClient<Database>(
    serviceUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
