'use client';

import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Upload, FileText, LayoutTemplate } from 'lucide-react';
import { DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { importProject } from '@/lib/requests/project';
import { useCreateProject } from '@/hooks/create-project-client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getTemplates } from '@/actions/get-templates';
import type { ProjectTemplate } from '@/lib/templates';

interface CreateProjectTabsProps {
  onSuccess: (projectId: string) => void;
  onError?: (error: string) => void;
}

export function CreateProjectTabs({
  onSuccess,
  onError,
}: CreateProjectTabsProps) {
  const [activeTab, setActiveTab] = useState('create');

  const [title, setTitle] = useState('');
  const [useTemplate, setUseTemplate] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [availableTemplates, setAvailableTemplates] = useState<
    ProjectTemplate[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { createProjectWithRefresh } = useCreateProject();

  // Fetch available templates on mount
  useEffect(() => {
    async function loadTemplates() {
      try {
        const templates = await getTemplates();
        setAvailableTemplates(templates);
        if (templates.length === 1) {
          setSelectedTemplateId(templates[0].id);
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
      }
    }
    loadTemplates();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsLoading(true);
    setError(null);

    const templateId = useTemplate ? selectedTemplateId : null;
    const result = await createProjectWithRefresh(title, templateId);

    if (result.success && result.projectId) {
      const message =
        useTemplate && selectedTemplateId
          ? 'Project created from template!'
          : 'Empty project created!';
      toast.success(message);
      setTitle('');
      setUseTemplate(false);
      onSuccess(result.projectId);
    } else {
      const errorMessage = result.message || 'Failed to create project';
      setError(errorMessage);
      onError?.(errorMessage);
    }

    setIsLoading(false);
  };

  const onDrop = (acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError('File size must be less than 50MB');
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Please select a ZIP file');
      } else {
        setError('Invalid file');
      }
      setSelectedFile(null);
      return;
    }

    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setError(null);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip'],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
    disabled: isLoading,
  });

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await importProject(selectedFile);

      if (!data.success) {
        throw new Error(data.error || 'Failed to import project');
      }

      if (data.success && data.projectId) {
        const message =
          data.otherFiles && data.otherFiles > 0
            ? `Project imported successfully! ${data.texFiles} LaTeX file(s) and ${data.otherFiles} other file(s).`
            : `Project imported successfully! ${data.texFiles} LaTeX file(s).`;
        toast.success(message);
        setSelectedFile(null);
        onSuccess(data.projectId);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to import project';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const hasTemplates = availableTemplates.length > 0;
  const singleTemplate =
    availableTemplates.length === 1 ? availableTemplates[0] : null;

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="create">Create New</TabsTrigger>
        <TabsTrigger value="import">Import ZIP</TabsTrigger>
      </TabsList>

      <TabsContent value="create" className="mt-4">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-3">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter project title"
              disabled={isLoading}
            />
          </div>

          {/* Template selection */}
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="use-template"
                checked={useTemplate}
                onCheckedChange={(checked) => {
                  setUseTemplate(checked === true);
                  if (checked && singleTemplate) {
                    setSelectedTemplateId(singleTemplate.id);
                  }
                }}
                disabled={!hasTemplates || isLoading}
              />
              <Label
                htmlFor="use-template"
                className={cn(
                  'cursor-pointer',
                  !hasTemplates && 'cursor-not-allowed text-muted-foreground'
                )}
              >
                Create from template
              </Label>
            </div>

            {useTemplate && hasTemplates && (
              <div>
                {singleTemplate ? (
                  // single template: show as text
                  <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                    <LayoutTemplate className="h-4 w-4 text-primary" />
                    <div>
                      <span className="font-medium">{singleTemplate.name}</span>
                      <span className="ml-2 text-neutral-500">
                        {singleTemplate.description}
                      </span>
                    </div>
                  </div>
                ) : (
                  // multiple templates: dropdown
                  <Select
                    value={selectedTemplateId || undefined}
                    onValueChange={setSelectedTemplateId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex flex-col text-left">
                            <span>{template.name}</span>
                            <span className="text-xs text-neutral-500">
                              {template.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {!hasTemplates && (
              <p className="text-xs text-neutral-500">No templates available</p>
            )}

            {!useTemplate && (
              <p className="flex items-center gap-2 text-sm text-neutral-500">
                <FileText className="h-3 w-3" />
                Creates an empty project with a single main.tex file
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isLoading}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={
                isLoading ||
                !title.trim() ||
                (useTemplate && !selectedTemplateId)
              }
            >
              {isLoading ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </TabsContent>
      <TabsContent value="import" className="mt-4">
        <form onSubmit={handleImportSubmit} className="grid gap-4">
          <div className="grid gap-3">
            <Label htmlFor="zipFile">ZIP File</Label>

            <div
              {...getRootProps()}
              className={cn(
                'relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors duration-200',
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50',
                isLoading && 'cursor-not-allowed opacity-50'
              )}
            >
              <input {...getInputProps()} />

              <div className="flex flex-col items-center gap-2">
                <Upload
                  className={cn(
                    'h-10 w-10',
                    isDragActive ? 'text-primary' : 'text-neutral-400'
                  )}
                />
                <div className="text-sm">
                  <span className="font-medium text-primary">
                    Click to upload
                  </span>
                  <span className="text-neutral-600"> or drag and drop</span>
                </div>
                <p className="text-xs text-neutral-500">ZIP files up to 50MB</p>
              </div>
            </div>

            {selectedFile && (
              <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-neutral-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm">
                  <div className="rounded bg-primary/10 p-1">
                    <Upload className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 max-w-full">
                    <p
                      className="block max-w-[220px] truncate font-medium text-neutral-900 sm:max-w-[320px]"
                      title={selectedFile.name}
                    >
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-end sm:self-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  disabled={isLoading}
                >
                  Remove
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isLoading}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={isLoading || !selectedFile}
              className="gap-2"
            >
              {isLoading ? (
                'Importing...'
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </TabsContent>
    </Tabs>
  );
}
