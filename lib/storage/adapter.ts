/**
 * Storage Adapter - Switches between Supabase Storage and Database Storage
 * based on USE_DATABASE_STORAGE environment variable
 *
 * Dev: Uses Supabase Storage (default)
 * Prod: Uses Database Storage (set USE_DATABASE_STORAGE=true)
 */

import type { TablesInsert } from '@/database.types';
import { isBinaryFile } from '@/lib/constants/file-types';

const USE_DB_STORAGE = process.env.NEXT_PUBLIC_USE_DATABASE_STORAGE === 'true';

export interface StorageFile {
  id: string;
  name: string;
  size: number | null;
  type: string | null;
  created_at: string;
}

export interface FileContent {
  content: string;
  file: StorageFile;
}

/**
 * Upload file to storage (Storage or Database)
 */
export async function uploadFile(
  supabase: any,
  projectId: string,
  fileName: string,
  content: string | ArrayBuffer | File | Blob,
  contentType?: string,
  isBinary?: boolean
): Promise<{ data?: any; error: any }> {
  // Auto-detect content type if not provided
  if (!contentType && content instanceof File) {
    contentType = content.type;
  }
  if (!contentType) {
    // Use a helper to determine content type from fileName
    const { getContentTypeByFilename } =
      await import('@/lib/constants/file-types');
    contentType = getContentTypeByFilename(fileName);
  }

  // Auto-detect binary if not provided
  if (isBinary === undefined) {
    isBinary = isBinaryFile(fileName);
  }

  // Convert File/Blob to ArrayBuffer if needed
  let actualContent: string | ArrayBuffer;
  if (content instanceof File || content instanceof Blob) {
    if (
      isBinary ||
      content.type.startsWith('image/') ||
      content.type.includes('pdf')
    ) {
      actualContent = await content.arrayBuffer();
    } else {
      actualContent = await content.text();
    }
  } else {
    actualContent = content;
  }

  if (USE_DB_STORAGE) {
    // Database storage
    let contentStr: string;
    let fileSize: number;

    if (actualContent instanceof ArrayBuffer) {
      // Binary content as ArrayBuffer - convert to base64
      contentStr = Buffer.from(actualContent).toString('base64');
      fileSize = actualContent.byteLength;
    } else if (typeof actualContent === 'string' && isBinary) {
      // Binary content already as base64 string (e.g., from template files)
      contentStr = actualContent;
      fileSize = actualContent.length;
    } else {
      // Text content
      contentStr = actualContent as string;
      fileSize = (actualContent as string).length;
    }

    const fileToInsert: TablesInsert<'files'> = {
      project_id: projectId,
      name: fileName,
      type: contentType,
      size: fileSize,
      content: contentStr,
      url: null,
    };

    const { data, error } = await supabase
      .from('files')
      .insert(fileToInsert)
      .select()
      .single();
    return { data, error };
  } else {
    // Supabase Storage
    const blob =
      actualContent instanceof ArrayBuffer
        ? new Blob([actualContent], { type: contentType })
        : new Blob([actualContent], { type: contentType });

    const { error } = await supabase.storage
      .from('lars')
      .upload(`projects/${projectId}/${fileName}`, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType,
      });

    if (!error) {
      // Also create database record for storage mode
      const fileSize = blob.size;
      const fileRecord: TablesInsert<'files'> = {
        project_id: projectId,
        name: fileName,
        type: contentType,
        size: fileSize,
        content: null,
        url: `projects/${projectId}/${fileName}`,
      };
      const { data } = await supabase
        .from('files')
        .insert(fileRecord)
        .select()
        .single();
      return { data, error };
    }

    return { error };
  }
}

/**
 * Download file from storage (Storage or Database)
 */
export async function downloadFile(
  supabase: any,
  projectId: string,
  fileName: string
): Promise<{ data: string | null; error: any }> {
  if (USE_DB_STORAGE) {
    // Database storage
    const { data, error } = await supabase
      .from('files')
      .select('content')
      .eq('project_id', projectId)
      .eq('name', fileName)
      .single();

    if (error || !data) {
      return { data: null, error };
    }

    return { data: data.content || '', error: null };
  } else {
    // Supabase Storage
    const { data: fileBlob, error } = await supabase.storage
      .from('lars')
      .download(`projects/${projectId}/${fileName}`);

    if (error || !fileBlob) {
      return { data: null, error };
    }

    let content: string;
    if (isBinaryFile(fileName)) {
      const arrayBuffer = await fileBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 32768;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
      }
      content = btoa(binary);
    } else {
      content = await fileBlob.text();
    }

    return { data: content, error: null };
  }
}

/**
 * List files in project (Storage or Database)
 */
export async function listFiles(
  supabase: any,
  projectId: string
): Promise<{ data: StorageFile[] | null; error: any }> {
  if (USE_DB_STORAGE) {
    // Database storage
    const { data, error } = await supabase
      .from('files')
      .select('id, name, size, type, uploaded_at')
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    const files: StorageFile[] = (data || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.type,
      created_at: f.uploaded_at || new Date().toISOString(),
    }));

    return { data: files, error: null };
  } else {
    // Supabase Storage - list from database records
    const { data, error } = await supabase
      .from('files')
      .select('id, name, size, type, uploaded_at')
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    const files: StorageFile[] = (data || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.type,
      created_at: f.uploaded_at || new Date().toISOString(),
    }));

    return { data: files, error: null };
  }
}

/**
 * Delete file from storage (Storage or Database)
 */
export async function deleteFile(
  supabase: any,
  projectId: string,
  fileName: string
): Promise<{ error: any }> {
  if (USE_DB_STORAGE) {
    // Database storage
    const { error } = await supabase
      .from('files')
      .delete()
      .eq('project_id', projectId)
      .eq('name', fileName);

    return { error };
  } else {
    // Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('lars')
      .remove([`projects/${projectId}/${fileName}`]);

    if (!storageError) {
      // Also delete database record
      await supabase
        .from('files')
        .delete()
        .eq('project_id', projectId)
        .eq('name', fileName);
    }

    return { error: storageError };
  }
}

/**
 * Update file content (Storage or Database)
 */
export async function updateFile(
  supabase: any,
  projectId: string,
  fileName: string,
  content: string,
  contentType: string,
  isBinary: boolean
): Promise<{ error: any }> {
  if (USE_DB_STORAGE) {
    // Database storage
    const fileSize = isBinary
      ? Buffer.from(content, 'base64').length
      : content.length;

    const { error } = await supabase
      .from('files')
      .update({
        content,
        size: fileSize,
        type: contentType,
      })
      .eq('project_id', projectId)
      .eq('name', fileName);

    return { error };
  } else {
    // Supabase Storage
    const blob = new Blob([content], { type: contentType });

    // Delete old file
    await supabase.storage
      .from('lars')
      .remove([`projects/${projectId}/${fileName}`]);

    // Upload new file
    const { error } = await supabase.storage
      .from('lars')
      .upload(`projects/${projectId}/${fileName}`, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType,
      });

    if (!error) {
      // Update database record
      await supabase
        .from('files')
        .update({
          size: blob.size,
          type: contentType,
        })
        .eq('project_id', projectId)
        .eq('name', fileName);
    }

    return { error };
  }
}

/**
 * Rename file (Storage or Database)
 */
export async function renameFile(
  supabase: any,
  projectId: string,
  currentName: string,
  newName: string
): Promise<{ error: any }> {
  if (USE_DB_STORAGE) {
    // Database storage - just update the name field
    const { error } = await supabase
      .from('files')
      .update({ name: newName })
      .eq('project_id', projectId)
      .eq('name', currentName);
    return { error };
  } else {
    // Supabase Storage - move file
    const { error: moveError } = await supabase.storage
      .from('lars')
      .move(
        `projects/${projectId}/${currentName}`,
        `projects/${projectId}/${newName}`
      );

    if (!moveError) {
      // Update database record
      await supabase
        .from('files')
        .update({ name: newName, url: `projects/${projectId}/${newName}` })
        .eq('project_id', projectId)
        .eq('name', currentName);
    }

    return { error: moveError };
  }
}
