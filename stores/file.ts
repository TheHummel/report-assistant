import { create } from 'zustand';
import type { ProjectFile, FileData } from '@/hooks/use-file-editor';

type FileStoreState = {
  selectedFile: FileData | null;
  projectFiles: ProjectFile[] | null;
  modifiedFiles: Set<string>; // track file IDs with unsaved changes
};

const DEFAULT_STATE: FileStoreState = {
  selectedFile: null,
  projectFiles: null,
  modifiedFiles: new Set(),
};

export const useFileStore = create<FileStoreState>(() => DEFAULT_STATE);

export const useProjectFiles = () => {
  return useFileStore((state) => state.projectFiles);
};

export const useSelectedFile = () => {
  return useFileStore((state) => state.selectedFile);
};

export const useFileContent = () => {
  return useFileStore((state) => {
    const { selectedFile, projectFiles } = state;
    if (!selectedFile || !projectFiles) return null;
    const projectFile = projectFiles.find((f) => f.file.id === selectedFile.id);
    return projectFile?.document?.content ?? null;
  });
};

export const useModifiedFiles = () => {
  return useFileStore((state) => state.modifiedFiles);
};

export const useIsFileModified = (fileId: string | null | undefined) => {
  return useFileStore((state) =>
    fileId ? state.modifiedFiles.has(fileId) : false
  );
};

const getState = useFileStore.getState;
const setState = useFileStore.setState;

export const FileActions = {
  setSelectedFile: (file: FileData | null) => {
    setState({ selectedFile: file });
  },

  setContent: (content: string) => {
    const { selectedFile, projectFiles, modifiedFiles } = getState();

    if (!selectedFile || !projectFiles) {
      return;
    }

    const updatedFiles = projectFiles.map((projectFile) => {
      if (projectFile.file.id === selectedFile.id && projectFile.document) {
        return {
          ...projectFile,
          document: { ...projectFile.document, content },
        };
      }
      return projectFile;
    });

    // mark file as modified
    const newModifiedFiles = new Set(modifiedFiles);
    newModifiedFiles.add(selectedFile.id);

    setState({ projectFiles: updatedFiles, modifiedFiles: newModifiedFiles });
  },

  reset: () => {
    setState(DEFAULT_STATE);
  },

  markFileSaved: (fileId: string) => {
    const { modifiedFiles } = getState();
    const newModifiedFiles = new Set(modifiedFiles);
    newModifiedFiles.delete(fileId);
    setState({ modifiedFiles: newModifiedFiles });
  },

  markFileModified: (fileId: string) => {
    const { modifiedFiles } = getState();
    const newModifiedFiles = new Set(modifiedFiles);
    newModifiedFiles.add(fileId);
    setState({ modifiedFiles: newModifiedFiles });
  },

  updateFileContent: (fileId: string, content: string) => {
    const { projectFiles, modifiedFiles } = getState();

    if (!projectFiles) return;

    const updatedFiles = projectFiles.map((projectFile) => {
      if (projectFile.file.id === fileId && projectFile.document) {
        return {
          ...projectFile,
          document: { ...projectFile.document, content },
        };
      }
      return projectFile;
    });

    // Mark file as modified
    const newModifiedFiles = new Set(modifiedFiles);
    newModifiedFiles.add(fileId);

    setState({ projectFiles: updatedFiles, modifiedFiles: newModifiedFiles });
  },

  getModifiedFilesData: (): Array<{
    fileId: string;
    fileName: string;
    content: string;
  }> => {
    const { modifiedFiles, projectFiles } = getState();
    if (!projectFiles) return [];

    return Array.from(modifiedFiles)
      .map((fileId) => {
        const projectFile = projectFiles.find((f) => f.file.id === fileId);
        if (!projectFile?.document) return null;
        return {
          fileId,
          fileName: projectFile.file.name,
          content: projectFile.document.content,
        };
      })
      .filter(
        (f): f is { fileId: string; fileName: string; content: string } =>
          f !== null
      );
  },

  setProjectFiles: (files: ProjectFile[]) => {
    const { selectedFile, projectFiles: currentFiles } = getState();

    // if currently selected file, preserve its in-memory content
    if (selectedFile && currentFiles) {
      const currentSelectedFile = currentFiles.find(
        (f) => f.file.id === selectedFile.id
      );
      if (currentSelectedFile?.document) {
        // merge: update file list but keep current file's content
        const updatedFiles = files.map((f) => {
          if (f.file.id === selectedFile.id) {
            return {
              ...f,
              document: currentSelectedFile.document, // preserve in-memory content
            };
          }
          return f;
        });
        setState({ projectFiles: updatedFiles });
        return;
      }
    }

    // default: just update files
    setState({ projectFiles: files });
  },

  init: (files: ProjectFile[]) => {
    const selectedFile = selectInitialFile(files);
    setState({ projectFiles: files, selectedFile });
  },
};

const selectInitialFile = (files: ProjectFile[]): FileData | null => {
  const mainTexFile = files.find((f) => f.file.name === 'main.tex');
  return mainTexFile
    ? mainTexFile.file
    : files.length > 0
      ? files[0].file
      : null;
};
