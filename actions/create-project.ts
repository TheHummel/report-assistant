'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TablesInsert } from '@/database.types';
import { z } from 'zod';
import {
  getTemplateFiles,
  getTemplateById,
  EMPTY_PROJECT_FILE,
} from '@/lib/templates';

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
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      redirect('/auth/login');
    }

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
  const filePath = `projects/${projectId}/${fileName}`;

  const fileContent = isBinary ? Buffer.from(content, 'base64') : content;

  const { error: storageError } = await supabase.storage
    .from('lars')
    .upload(filePath, fileContent, {
      contentType,
      upsert: false,
    });

  if (storageError) {
    console.error(`Error uploading file ${fileName} to storage:`, storageError);
    throw new Error(`Failed to upload file ${fileName} to storage`);
  }

  const { data: urlData } = supabase.storage
    .from('lars')
    .getPublicUrl(filePath);

  const fileSize = isBinary
    ? Buffer.from(content, 'base64').length
    : content.length;

  const fileToInsert: TablesInsert<'files'> = {
    project_id: projectId,
    name: fileName,
    type: contentType,
    size: fileSize,
    url: urlData.publicUrl,
  };

  const { error: fileError } = await (supabase.from('files') as any).insert(
    fileToInsert
  );

  if (fileError) {
    console.error(`Error creating file record for ${fileName}:`, fileError);
    throw new Error(`Failed to create file record for ${fileName}`);
  }
}
