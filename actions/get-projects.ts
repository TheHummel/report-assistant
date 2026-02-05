'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/requests/user';
import type { Tables } from '@/database.types';

export async function getAllProjects(): Promise<Tables<'projects'>[] | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = (
    user.app_metadata?.provider === 'email'
      ? await createClient()
      : await createServiceClient()
  ) as any;

  const { data } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  return data;
}

export async function getProjectById(
  projectId: string
): Promise<Pick<Tables<'projects'>, 'title'> | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const supabase = (
    user.app_metadata?.provider === 'email'
      ? await createClient()
      : await createServiceClient()
  ) as any;

  const { data } = await (supabase as any)
    .from('projects' as const)
    .select('title')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  return data;
}
