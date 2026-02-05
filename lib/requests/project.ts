import { createClient } from '@/lib/supabase/client';
import type { ProjectFile } from '@/hooks/use-file-editor';
import { isBinaryFile } from '@/lib/constants/file-types';
import {
  listFiles,
  downloadFile,
  renameFile as renameFileAdapter,
  deleteFile as deleteFileAdapter,
  uploadFile,
} from '@/lib/storage/adapter';

export const getProject = async (projectId: string) => {
  const supabase = createClient();

  // For authenticated users, we don't have a session but RLS policies still work
  // because the service client is used on the server side
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
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

  // For authenticated users, we don't have a session but RLS policies still work
  // because the service client is used on the server side

  // Use storage adapter (works with both Storage and Database modes)
  const { data: files, error } = await listFiles(supabase, projectId);

  if (error) {
    console.error('Error fetching files:', error);
    throw new Error('Failed to fetch project files');
  }

  if (!files || files.length === 0) return [];

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
          console.warn(`Failed to download file ${file.name}:`, downloadError);
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
            owner_id: '', // Not needed for authenticated users
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

  return filesWithContent.filter((item) => item !== null) as ProjectFile[];
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

  const { error } = await renameFileAdapter(
    supabase,
    projectId,
    currentName,
    newName
  );

  if (error) {
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

  const { error } = await deleteFileAdapter(supabase, projectId, fileName);

  if (error) {
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

  const { error } = await uploadFile(supabase, projectId, gitkeepPath, blob);

  if (error) {
    throw new Error('Failed to create folder');
  }
};

async function listFolderFilesRecursively(
  supabase: any,
  projectId: string,
  folderPath: string
): Promise<string[]> {
  // In database storage mode, query files table for files starting with folderPath
  const USE_DB_STORAGE =
    process.env.NEXT_PUBLIC_USE_DATABASE_STORAGE === 'true';

  if (USE_DB_STORAGE) {
    const { data: files, error } = await supabase
      .from('files')
      .select('name')
      .eq('project_id', projectId)
      .like('name', `${folderPath}/%`);

    if (error) {
      console.error('Error listing folder files:', error);
      return [];
    }

    return files?.map((f: any) => f.name) || [];
  }

  // Storage mode
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

  const USE_DB_STORAGE =
    process.env.NEXT_PUBLIC_USE_DATABASE_STORAGE === 'true';

  // Move all files to new location
  for (const filePath of filesToMove) {
    // calc relative path within the folder
    const relativePath = filePath.substring(currentPath.length + 1);
    const newFileName = `${newPath}/${relativePath}`;

    if (USE_DB_STORAGE) {
      // Database storage - update file name
      const { error } = await (supabase as any)
        .from('files')
        .update({ name: newFileName })
        .eq('project_id', projectId)
        .eq('name', filePath);

      if (error) {
        console.error('Update error for', filePath, ':', error);
        throw new Error(`Failed to move file: ${filePath}`);
      }
    } else {
      // Storage mode - move file
      const oldFullPath = `projects/${projectId}/${filePath}`;
      const newFullPath = `projects/${projectId}/${newFileName}`;

      const { error: moveError } = await (supabase as any).storage
        .from('lars')
        .move(oldFullPath, newFullPath);

      if (moveError) {
        console.error('Move error for', filePath, ':', moveError);
        throw new Error(`Failed to move file: ${filePath}`);
      }

      // Update database record
      await (supabase as any)
        .from('files')
        .update({ name: newFileName, url: newFullPath })
        .eq('project_id', projectId)
        .eq('name', filePath);
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

  const USE_DB_STORAGE =
    process.env.NEXT_PUBLIC_USE_DATABASE_STORAGE === 'true';

  if (USE_DB_STORAGE) {
    // Database storage - delete file records
    for (const filePath of filesToDelete) {
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('project_id', projectId)
        .eq('name', filePath);

      if (error) {
        console.error('Delete error for', filePath, ':', error);
        throw new Error(`Failed to delete file: ${filePath}`);
      }
    }
  } else {
    // Storage mode - delete from storage
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

    // Delete database records
    for (const filePath of filesToDelete) {
      await supabase
        .from('files')
        .delete()
        .eq('project_id', projectId)
        .eq('name', filePath);
    }
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
  const uploadResult = await uploadFile(
    supabase,
    projectId,
    filePath,
    imageFile
  );

  if (uploadResult.error) {
    throw new Error(`Failed to upload image: ${uploadResult.error.message}`);
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
