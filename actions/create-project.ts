'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TablesInsert } from '@/database.types';
import { z } from 'zod';
import { getRadiationTemplateFiles } from '@/data/radiation-template';

const CreateProject = z.object({
  title: z.string().min(1, 'Project title is required').trim(),
});

type State = {
  projectId: string | null;
  message?: string | null;
  success?: boolean;
};

export async function createProject(title: string) {
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
    });

    if (!validatedFields.success) {
      throw new Error(validatedFields.error.errors[0].message);
    }

    const { title: validatedTitle } = validatedFields.data;

    const projectData: TablesInsert<'projects'> = {
      title: validatedTitle,
      user_id: user.id,
    };

    const { data, error } = await (supabase.from('projects') as any)
      .insert(projectData)
      .select()
      .single();

    if (error) {
      console.error('Error creating project:', error);
      throw new Error('Failed to create project');
    }

    // get template files for the radiation test report
    const templateFiles = await getRadiationTemplateFiles(validatedTitle);

    // upload files to storage
    for (const templateFile of templateFiles) {
      const filePath = `projects/${data.id}/${templateFile.path}`;

      const fileContent = templateFile.isBinary
        ? Buffer.from(templateFile.content, 'base64')
        : templateFile.content;

      const { error: storageError } = await supabase.storage
        .from('octree')
        .upload(filePath, fileContent, {
          contentType: templateFile.contentType,
          upsert: false,
        });

      if (storageError) {
        console.error(
          `Error uploading file ${templateFile.path} to storage:`,
          storageError
        );
        throw new Error(
          `Failed to upload file ${templateFile.path} to storage`
        );
      }

      const { data: urlData } = supabase.storage
        .from('octree')
        .getPublicUrl(filePath);

      const fileSize = templateFile.isBinary
        ? Buffer.from(templateFile.content, 'base64').length
        : templateFile.content.length;

      const fileToInsert: TablesInsert<'files'> = {
        project_id: data.id,
        name: templateFile.path,
        type: templateFile.contentType,
        size: fileSize,
        url: urlData.publicUrl,
      };

      const { error: fileError } = await (supabase.from('files') as any).insert(
        fileToInsert
      );

      if (fileError) {
        console.error(
          `Error creating file record for ${templateFile.path}:`,
          fileError
        );
        throw new Error(
          `Failed to create file record for ${templateFile.path}`
        );
      }
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
    };
  }
}
