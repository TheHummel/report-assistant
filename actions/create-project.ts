'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/requests/user';
import { TablesInsert } from '@/database.types';
import { z } from 'zod';
import { headers } from 'next/headers';
import {
  getTemplateFiles,
  getTemplateById,
  EMPTY_PROJECT_FILE,
} from '@/lib/templates';
import { uploadFile } from '@/lib/storage/adapter';

const CreateProject = z.object({
  title: z.string().min(1, 'Project title is required').trim(),
  templateId: z.string().nullable().optional(),
});

type CreateProjectResult = {
  projectId: string | null;
  message?: string | null;
  success?: boolean;
};

export async function createProject(
  title: string,
  templateId?: string | null
): Promise<CreateProjectResult> {
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

    const validatedFields = CreateProject.safeParse({
      title,
      templateId,
    });

    if (!validatedFields.success) {
      throw new Error(validatedFields.error.errors[0].message);
    }

    const { title: validatedTitle, templateId: validatedTemplateId } =
      validatedFields.data;

    // verify template exists if provided
    if (validatedTemplateId) {
      const template = getTemplateById(validatedTemplateId);
      if (!template) {
        throw new Error(`Template not found: ${validatedTemplateId}`);
      }
    }

    // create project record
    const projectData: TablesInsert<'projects'> = {
      title: validatedTitle,
      user_id: user.id,
      template_id: validatedTemplateId || null,
    };

    const { data, error } = await (supabase.from('projects') as any)
      .insert(projectData)
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      throw new Error('Failed to create project');
    }

    // Get files to upload
    if (validatedTemplateId) {
      // Use template files
      const templateFiles = await getTemplateFiles(validatedTemplateId);

      for (const templateFile of templateFiles) {
        await uploadFileToProject(
          supabase,
          data.id,
          templateFile.path,
          templateFile.content,
          templateFile.contentType,
          templateFile.isBinary
        );
      }
    } else {
      // Create empty project with single main.tex
      await uploadFileToProject(
        supabase,
        data.id,
        EMPTY_PROJECT_FILE.name,
        EMPTY_PROJECT_FILE.content,
        EMPTY_PROJECT_FILE.contentType,
        false
      );
    }

    revalidatePath('/');

    return {
      projectId: data.id,
      message: null,
      success: true,
    };
  } catch (error) {
    console.error('Error creating project:', error);
    return {
      projectId: null,
      message:
        error instanceof Error ? error.message : 'Failed to create project',
      success: false,
    };
  }
}

async function uploadFileToProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  fileName: string,
  content: string,
  contentType: string,
  isBinary: boolean
): Promise<void> {
  // Use storage adapter (handles both Storage and Database modes)
  const { error } = await uploadFile(
    supabase as any,
    projectId,
    fileName,
    content,
    contentType,
    isBinary
  );

  if (error) {
    console.error(`Error uploading file ${fileName}:`, error);
    throw new Error(`Failed to upload file ${fileName}`);
  }
}
