import { createClient } from '@/lib/supabase/client';
import type { ProjectFile } from '@/hooks/use-file-editor';
import { isBinaryFile } from '@/lib/constants/file-types';

export const getProject = async (projectId: string) => {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', session.user.id)
    .single();

  if (error) throw error;
  return data;
};

async function listAllFiles(
  supabase: any,
  projectId: string,
  path: string = ''
): Promise<any[]> {
  const listPath = path
    ? `projects/${projectId}/${path}`
    : `projects/${projectId}`;

  const { data: items, error } = await supabase.storage
    .from('lars')
    .list(listPath, {
      sortBy: { column: 'created_at', order: 'desc' },
    });

  if (error || !items) return [];

  const allFiles: any[] = [];

  for (const item of items) {
    if (item.id) {
      const fullPath = path ? `${path}/${item.name}` : item.name;
      allFiles.push({
        ...item,
        name: fullPath,
      });
    } else if (item.name !== '.emptyFolderPlaceholder') {
      const subPath = path ? `${path}/${item.name}` : item.name;
      const subFiles = await listAllFiles(supabase, projectId, subPath);
      allFiles.push(...subFiles);
    }
  }

  return allFiles;
}

export const getProjectFiles = async (
  projectId: string
): Promise<ProjectFile[]> => {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  const storageFiles = await listAllFiles(supabase, projectId);

  if (!storageFiles || storageFiles.length === 0) return [];

  const actualFiles = storageFiles.filter((item) => item.id !== null);

  const filesWithContent = await Promise.all(
    actualFiles.map(async (storageFile) => {
      try {
        const cacheBuster = `?t=${Date.now()}`;
        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from('lars')
          .download(`projects/${projectId}/${storageFile.name}${cacheBuster}`);

        if (downloadError || !fileBlob) {
          console.warn(
            `Failed to download file ${storageFile.name}:`,
            downloadError
          );
          return {
            file: {
              id: storageFile.id,
              name: storageFile.name,
              project_id: projectId,
              size: null,
              type: null,
              uploaded_at: storageFile.created_at,
            },
            document: null,
          };
        }

        let content: string;
        if (isBinaryFile(storageFile.name)) {
          const arrayBuffer = await fileBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          // Convert to base64 in chunks to avoid stack overflow with large files
          let binary = '';
          const chunkSize = 32768; // Process 32KB at a time
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(
              null,
              chunk as unknown as number[]
            );
          }
          content = btoa(binary);
        } else {
          content = await fileBlob.text();
        }

        return {
          file: {
            id: storageFile.id,
            name: storageFile.name,
            project_id: projectId,
            size: storageFile.metadata?.size || null,
            type: storageFile.metadata?.mimetype || null,
            uploaded_at: storageFile.created_at,
          },
          document: {
            id: storageFile.id,
            title: storageFile.name,
            content: content,
            owner_id: session.user.id,
            project_id: projectId,
            filename: storageFile.name,
            document_type: storageFile.name === 'main.tex' ? 'article' : 'file',
            created_at: storageFile.created_at,
            updated_at: storageFile.updated_at || storageFile.created_at,
          },
        };
      } catch (error) {
        console.error(`Error processing file ${storageFile.name}:`, error);
        return {
          file: {
            id: storageFile.id,
            name: storageFile.name,
            project_id: projectId,
            size: null,
            type: null,
            uploaded_at: storageFile.created_at,
          },
          document: null,
        };
      }
    })
  );

  return filesWithContent.filter((item) => item.document !== null);
};

export interface ImportProjectResponse {
  success: boolean;
  projectId?: string;
  totalFiles?: number;
  texFiles?: number;
  otherFiles?: number;
  error?: string;
}

export const importProject = async (
  file: File
): Promise<ImportProjectResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/import-project', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: data.error || 'Failed to import project',
    };
  }

  return data;
};

export const renameFile = async (
  projectId: string,
  currentName: string,
  newName: string
): Promise<void> => {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  const { error: moveError } = await supabase.storage
    .from('lars')
    .move(
      `projects/${projectId}/${currentName}`,
      `projects/${projectId}/${newName}`
    );

  if (moveError) {
    throw new Error('Failed to rename file');
  }
};

export const deleteFile = async (
  projectId: string,
  fileId: string,
  fileName: string
): Promise<void> => {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  const { error: deleteError } = await supabase.storage
    .from('lars')
    .remove([`projects/${projectId}/${fileName}`]);

  if (deleteError) {
    throw new Error('Failed to delete file');
  }
};

export const createFolder = async (
  projectId: string,
  folderPath: string
): Promise<void> => {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  const gitkeepPath = `${folderPath}/.gitkeep`;
  const blob = new Blob([''], { type: 'text/plain' });

  const { error: uploadError } = await supabase.storage
    .from('lars')
    .upload(`projects/${projectId}/${gitkeepPath}`, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'text/plain',
    });

  if (uploadError) {
    throw new Error('Failed to create folder');
  }
};

async function listFolderFilesRecursively(
  supabase: any,
  projectId: string,
  folderPath: string
): Promise<string[]> {
  const listPath = `projects/${projectId}/${folderPath}`;
  const { data: items, error } = await supabase.storage
    .from('lars')
    .list(listPath);

  if (error || !items) {
    console.error('Error listing folder:', error);
    return [];
  }

  const allFiles: string[] = [];

  for (const item of items) {
    const itemPath = `${folderPath}/${item.name}`;
    if (item.id) {
      // file
      allFiles.push(itemPath);
    } else {
      // subfolder; recurse
      const subFiles = await listFolderFilesRecursively(
        supabase,
        projectId,
        itemPath
      );
      allFiles.push(...subFiles);
    }
  }

  return allFiles;
}

export const renameFolder = async (
  projectId: string,
  currentPath: string,
  newPath: string
): Promise<void> => {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  // list all files recursively
  const filesToMove = await listFolderFilesRecursively(
    supabase,
    projectId,
    currentPath
  );

  if (filesToMove.length === 0) {
    throw new Error('Folder is empty or does not exist');
  }

  // Move all files to new location
  for (const filePath of filesToMove) {
    // calc relative path within the folder
    const relativePath = filePath.substring(currentPath.length + 1);
    const oldFullPath = `projects/${projectId}/${filePath}`;
    const newFullPath = `projects/${projectId}/${newPath}/${relativePath}`;

    const { error: moveError } = await supabase.storage
      .from('lars')
      .move(oldFullPath, newFullPath);

    if (moveError) {
      console.error('Move error for', filePath, ':', moveError);
      throw new Error(`Failed to move file: ${filePath}`);
    }
  }
};

export const deleteFolder = async (
  projectId: string,
  folderPath: string
): Promise<void> => {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  // list all files recursively
  const filesToDelete = await listFolderFilesRecursively(
    supabase,
    projectId,
    folderPath
  );

  if (filesToDelete.length === 0) {
    throw new Error('Folder is empty or does not exist');
  }

  // delete all files
  const fullPaths = filesToDelete.map(
    (path) => `projects/${projectId}/${path}`
  );

  const { error: deleteError } = await supabase.storage
    .from('lars')
    .remove(fullPaths);

  if (deleteError) {
    console.error('Delete error:', deleteError);
    throw new Error('Failed to delete folder contents');
  }
};

/**
 * Upload an image file to the project's Images folder
 */
export const uploadImageToProject = async (
  projectId: string,
  imageFile: File,
  fileName: string
): Promise<string> => {
  const supabase = createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  // upload to Images folder
  const filePath = `Images/${fileName}`;
  const fullPath = `projects/${projectId}/${filePath}`;

  const { error: uploadError } = await supabase.storage
    .from('lars')
    .upload(fullPath, imageFile, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  return filePath;
};

/**
 * Convert base64 data URL to File object
 */
export const dataUrlToFile = (dataUrl: string, fileName: string): File => {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], fileName, { type: mime });
};
