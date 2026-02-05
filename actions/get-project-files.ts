'use server';

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/requests/user';
import { headers } from 'next/headers';
import type { ProjectFile } from '@/hooks/use-file-editor';
import { listFiles, downloadFile } from '@/lib/storage/adapter';

export async function getProjectFiles(
  projectId: string
): Promise<{ data: ProjectFile[] | null; error: string | null }> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    // Check if user is authenticated via headers
    const headersList = await headers();
    const email = headersList.get('x-forwarded-user');

    // Use service client for users authenticated via headers (bypasses RLS), regular client for Supabase auth users
    const supabase = (
      email ? await createServiceClient() : await createClient()
    ) as any;

    // Verify user owns this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return { data: null, error: 'Project not found or access denied' };
    }

    // Use storage adapter (works with both Storage and Database modes)
    const { data: files, error: filesError } = await listFiles(
      supabase,
      projectId
    );

    if (filesError) {
      console.error('Error fetching files:', filesError);
      return { data: null, error: 'Failed to fetch project files' };
    }

    if (!files || files.length === 0) {
      return { data: [], error: null };
    }

    // Download content for each file
    const filesWithContent = await Promise.all(
      files.map(async (file) => {
        try {
          const { data: content, error: downloadError } = await downloadFile(
            supabase,
            projectId,
            file.name
          );

          if (downloadError || !content) {
            console.warn(
              `Failed to download file ${file.name}:`,
              downloadError
            );
            return null;
          }

          return {
            file: {
              id: file.id,
              name: file.name,
              project_id: projectId,
              size: file.size,
              type: file.type,
              uploaded_at: file.created_at,
            },
            document: {
              id: file.id,
              title: file.name,
              content: content,
              owner_id: user.id,
              project_id: projectId,
              filename: file.name,
              document_type: file.name === 'main.tex' ? 'article' : 'file',
              created_at: file.created_at,
              updated_at: file.created_at,
            },
          };
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          return null;
        }
      })
    );

    const validFiles = filesWithContent.filter(
      (item) => item !== null
    ) as ProjectFile[];

    return { data: validFiles, error: null };
  } catch (error) {
    console.error('Error in getProjectFiles:', error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to fetch project files',
    };
  }
}

export async function getProject(projectId: string) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    const headersList = await headers();
    const cernEmail = headersList.get('x-forwarded-user');

    const supabase = (
      cernEmail ? await createServiceClient() : await createClient()
    ) as any;

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error in getProject:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Failed to fetch project',
    };
  }
}

/**
 * Get file content by project ID and file name
 * Used for viewing images and other binary files
 */
export async function getFileContent(
  projectId: string,
  fileName: string
): Promise<{
  data: { content: string; type: string } | null;
  error: string | null;
}> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    // Check if user is authenticated via CERN headers
    const headersList = await headers();
    const cernEmail = headersList.get('x-forwarded-user');

    // Use service client for CERN users (bypasses RLS), regular client for Supabase auth users
    const supabase = (
      cernEmail ? await createServiceClient() : await createClient()
    ) as any;

    // Verify user owns this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return { data: null, error: 'Project not found or access denied' };
    }

    // Fetch file content from database
    const { data: fileRecord, error: fileError } = await supabase
      .from('files')
      .select('content, type')
      .eq('project_id', projectId)
      .eq('name', fileName)
      .single();

    if (fileError || !fileRecord) {
      console.error('Error fetching file:', fileError);
      return { data: null, error: 'File not found' };
    }

    return {
      data: {
        content: (fileRecord as any).content || '',
        type: (fileRecord as any).type || 'application/octet-stream',
      },
      error: null,
    };
  } catch (error) {
    console.error('Error in getFileContent:', error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : 'Failed to fetch file content',
    };
  }
}
