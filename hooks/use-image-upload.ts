import { useState, useCallback } from 'react';
import { EditSuggestion } from '@/types/edit';
import { v4 as uuid } from 'uuid';
import { convertImageToLatex } from '@/lib/image-to-latex';
import { uploadImageToProject, dataUrlToFile } from '@/lib/requests/project';
import { buildImageIntegrationPrompt } from '@/agent_server/lib/lars-agent/content-processing';

interface UseImageUploadProps {
  content: string;
  onSuggestion: (suggestion: EditSuggestion | EditSuggestion[]) => void;
  finalizeEdits: () => void;
  projectFiles?: Array<{ path: string; content: string }>;
  currentFilePath?: string | null;
  projectId: string;
}

export function useImageUpload({
  content,
  onSuggestion,
  finalizeEdits,
  projectFiles,
  currentFilePath,
  projectId,
}: UseImageUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImageUpload = useCallback(
    async (data: {
      image: string; // base64 data URL
      subsection: string; // file path
      subsectionName: string; // display name
      comment?: string;
      verbosity: 'low' | 'medium' | 'high';
    }) => {
      setIsProcessing(true);
      try {
        // Step 1: upload image to Images folder
        const timestamp = Date.now();
        const imageExtension = data.image.startsWith('data:image/png')
          ? 'png'
          : 'jpg';
        const imageName = `uploaded-${timestamp}.${imageExtension}`;

        const imageFile = dataUrlToFile(data.image, imageName);
        const imagePath = await uploadImageToProject(
          projectId,
          imageFile,
          imageName
        );

        // Step 2: extract content from image using CERN LiteLLM API
        const imageAnalysisResult = await convertImageToLatex(
          data.image,
          imageName
        );

        if (!imageAnalysisResult.success) {
          throw new Error(
            imageAnalysisResult.error || 'Failed to analyze image'
          );
        }

        const imageDescription = imageAnalysisResult.latex || '';

        // Step 3: find subsection file in projectFiles
        const subsectionFile = projectFiles?.find(
          (file) => file.path === data.subsection
        );

        if (!subsectionFile) {
          throw new Error(`Subsection file not found: ${data.subsection}`);
        }

        const subsectionContent = subsectionFile.content || '';

        // Step 4: build prompt for the agent to integrate image and image description
        const prompt = buildImageIntegrationPrompt(
          imageDescription,
          imagePath,
          data.subsection,
          data.subsectionName,
          subsectionContent,
          data.verbosity,
          data.comment
        );

        // Step 5: send request to agent service
        const response = await fetch('/api/lars-agent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            fileContent: subsectionContent,
            textFromEditor: subsectionContent,
            selectionRange: null,
            projectFiles: projectFiles || [],
            currentFilePath: data.subsection,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to process image');
        }

        // Step 6: read response and collect edit suggestions
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response stream');
        }

        let buffer = '';
        let hasReceivedEdits = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // process complete SSE events (separated by \n\n)
          let separatorIndex;
          while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
            const eventBlock = buffer.slice(0, separatorIndex);
            buffer = buffer.slice(separatorIndex + 2);

            // parse SSE format: event: <name>\ndata: <json>
            const eventMatch = eventBlock.match(/event:\s*(\S+)/);
            const dataMatch = eventBlock.match(/data:\s*([\s\S]+)/);

            if (eventMatch && dataMatch) {
              const eventName = eventMatch[1];

              try {
                const payload = JSON.parse(dataMatch[1]);

                // handle 'edits' event
                if (eventName === 'edits' && Array.isArray(payload)) {
                  if (hasReceivedEdits) {
                    continue;
                  }
                  hasReceivedEdits = true;

                  // convert all edits to suggestions at once
                  const suggestions: EditSuggestion[] = payload.map((edit) => ({
                    id: uuid(),
                    status: 'pending' as const,
                    ...edit,
                  }));

                  // pass all suggestions at once
                  onSuggestion(suggestions);
                } else if (eventName === 'error') {
                  const errorMsg = payload?.message || 'Agent error';
                  console.error('[Image Upload] Agent error:', errorMsg);
                  throw new Error(errorMsg);
                }
              } catch (e) {
                if (e instanceof Error && e.message.startsWith('Agent error')) {
                  throw e;
                }
                console.warn(
                  '[Image Upload] Failed to parse event:',
                  eventBlock
                );
              }
            }
          }
        }

        // finalize accumulated edits
        finalizeEdits();
      } catch (error) {
        console.error('Error processing image upload:', error);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [content, onSuggestion, finalizeEdits, projectFiles, currentFilePath]
  );

  return {
    handleImageUpload,
    isProcessing,
  };
}
