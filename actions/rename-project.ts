'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/requests/user';
import { headers } from 'next/headers';
import { z } from 'zod';

const RenameProject = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
});

export type RenameState = {
  projectId: string | null;
  title?: string | null;
  message?: string | null;
  success?: boolean;
};

export async function renameProject(
  prevState: RenameState,
  formData: FormData
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      redirect('/auth/login');
    }

    // Check if user is authenticated via headers
    const headersList = await headers();
    const email = headersList.get('x-forwarded-user');

    // Use service client for users authenticated via headers (bypasses RLS), regular client for Supabase auth users
    const supabase = (
      email ? await createServiceClient() : await createClient()
    ) as any;

    const validatedFields = RenameProject.safeParse({
      projectId: formData.get('projectId') as string,
      title: formData.get('title') as string,
    });

    if (!validatedFields.success) {
      throw new Error(validatedFields.error.errors[0].message);
    }

    const { projectId, title } = validatedFields.data;

    // Ensure the project belongs to the user
    const { data: project, error: projectError } = await (supabase as any)
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found or unauthorized');
    }

    const { error: updateError } = await (supabase as any)
      .from('projects')
      .update({ title })
      .eq('id', projectId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error renaming project:', updateError);
      throw new Error('Failed to rename project');
    }

    // Revalidate the projects dashboard
    revalidatePath('/projects');

    return {
      projectId,
      title,
      message: null,
      success: true,
    } satisfies RenameState;
  } catch (error) {
    console.error('Error renaming project:', error);
    return {
      projectId: null,
      title: null,
      message:
        error instanceof Error ? error.message : 'Failed to rename project',
      success: false,
    } satisfies RenameState;
  }
}
