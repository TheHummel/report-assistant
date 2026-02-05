'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/requests/user';
import { headers } from 'next/headers';
import { z } from 'zod';

const DeleteProject = z.object({
  projectId: z.string().uuid('Invalid project ID'),
});

export type State = {
  projectId: string | null;
  message?: string | null;
  success?: boolean;
};

export async function deleteProject(projectId: string) {
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

    const validatedFields = DeleteProject.safeParse({
      projectId,
    });

    if (!validatedFields.success) {
      throw new Error(validatedFields.error.errors[0].message);
    }

    const { projectId: validatedProjectId } = validatedFields.data;

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, title')
      .eq('id', validatedProjectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      throw new Error(
        'Project not found or you do not have permission to delete it'
      );
    }

    // Files are stored in database and will be deleted by CASCADE
    // when the project is deleted (files.project_id foreign key)

    const { error: documentsError } = await supabase
      .from('documents')
      .delete()
      .eq('project_id', validatedProjectId);

    if (documentsError) {
      console.error('Error deleting project documents:', documentsError);
      throw new Error('Failed to delete project documents');
    }

    const { error: filesError } = await supabase
      .from('files')
      .delete()
      .eq('project_id', validatedProjectId);

    if (filesError) {
      console.error('Error deleting project files:', filesError);
      throw new Error('Failed to delete project files');
    }

    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', validatedProjectId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting project:', deleteError);
      throw new Error('Failed to delete project');
    }

    revalidatePath('/projects');

    return {
      projectId: validatedProjectId,
      message: null,
      success: true,
    };
  } catch (error) {
    console.error('Error deleting project:', error);
    return {
      projectId: null,
      message:
        error instanceof Error ? error.message : 'Failed to delete project',
      success: false,
    };
  }
}
