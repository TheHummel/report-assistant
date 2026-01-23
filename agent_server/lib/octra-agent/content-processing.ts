/**
 * Content processing utilities for LaTeX documents
 * Handles file content formatting, numbering, and text processing
 */

export interface ProjectFileContext {
  path: string;
  content: string;
}

/**
 * Build numbered content with line numbers for better editing precision
 * Non-blocking version using setImmediate for large documents
 * @param fileContent - The raw file content
 * @param textFromEditor - Optional selected text from editor
 * @returns Promise resolving to numbered content string
 */
export async function buildNumberedContent(
  fileContent: string,
  textFromEditor?: string | null
): Promise<string> {
  return new Promise((resolve) => {
    // Use setImmediate to avoid blocking the event loop
    setImmediate(() => {
      const lines = fileContent.split('\n');
      const MAX_LINES_FULL_CONTEXT = 500;

      if (lines.length <= MAX_LINES_FULL_CONTEXT) {
        const numbered = lines
          .map((line, index) => `${index + 1}: ${line}`)
          .join('\n');
        resolve(numbered);
        return;
      }

      const startLines = lines
        .slice(0, 100)
        .map((line, index) => `${index + 1}: ${line}`)
        .join('\n');
      const endLines = lines
        .slice(-100)
        .map((line, index) => `${lines.length - 100 + index + 1}: ${line}`)
        .join('\n');

      let numbered = `${startLines}\n\n... [${lines.length - 200} lines omitted] ...\n\n${endLines}`;
      if (textFromEditor && textFromEditor.length > 0) {
        numbered += `\n\n[Selected region context will be provided separately]`;
      }
      resolve(numbered);
    });
  });
}

/**
 * Normalize line endings by converting CRLF and CR to LF
 * @param text - Text to normalize
 * @returns Normalized text with LF line endings
 */
export function normalizeLineEndings(text: string): string {
  return text.split('\r\n').join('\n').split('\r').join('\n');
}

/**
 * Validate API keys for required services
 * @returns Validation result with error message if invalid
 */
export function validateApiKeys(): { isValid: boolean; error?: string } {
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  if (!hasAnthropic) {
    return {
      isValid: false,
      error: 'No Anthropic API key configured. Please set ANTHROPIC_API_KEY.',
    };
  }
  return { isValid: true };
}

/**
 * Build system prompt for the AI agent
 * @param numberedContent - Numbered file content
 * @param textFromEditor - Optional selected text
 * @param selectionRange - Optional selection range
 * @returns Complete system prompt
 */
export function buildSystemPrompt(
  numberedContent: string,
  textFromEditor?: string | null,
  selectionRange?: { startLineNumber: number; endLineNumber: number } | null,
  projectFiles?: ProjectFileContext[] | null,
  currentFilePath?: string | null
): string {
  const validProjectFiles =
    projectFiles?.filter(
      (file): file is ProjectFileContext =>
        !!file &&
        typeof file.path === 'string' &&
        typeof file.content === 'string'
    ) ?? [];

  // separate text and image files
  const textFiles = validProjectFiles.filter(
    (file) => !file.path.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)
  );
  const imageFiles = validProjectFiles.filter((file) =>
    file.path.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)
  );

  const projectSection = validProjectFiles.length
    ? `

Project structure (${textFiles.length} text files${imageFiles.length > 0 ? `, ${imageFiles.length} images` : ''}):
${textFiles
  .map((file) => {
    const isCurrent = file.path === currentFilePath;
    // only include full content for current file, otherwise just list it
    if (isCurrent) {
      return `--- ${file.path} (CURRENT FILE - shown above with line numbers) ---`;
    } else {
      const lines = file.content.split('\n').length;
      return `  - ${file.path} (${lines} lines) - use get_context to read if needed`;
    }
  })
  .join('\n')}${
        imageFiles.length > 0
          ? `

Image files (available in compiled PDF):
${imageFiles.map((f) => `  - ${f.path}`).join('\n')}`
          : ''
      }`
    : '';

  return `You are Octra, a LaTeX editing assistant. You edit LaTeX documents by calling the 'propose_edits' tool.

ABSOLUTE RULE: For ANY editing request, you MUST:
1. Immediately call the 'propose_edits' tool with the edit
2. NEVER explain what should be done manually
3. NEVER say you're "encountering issues" - just call the tool

MULTI-FILE SUPPORT:
- Use get_context(filePath: "path/to/file") to read any project file
- Use propose_edits(filePath: "path/to/file", edits: [...]) to edit any project file
- If no filePath specified, operations apply to the current file

You have THREE edit types:
- INSERT: { editType: 'insert', position: { line: N }, content: '...', originalLineCount: 0 }
- DELETE: { editType: 'delete', position: { line: N }, originalLineCount: M }
- REPLACE: { editType: 'replace', position: { line: N }, content: '...', originalLineCount: M }

EXAMPLES:

User: "add a title"
You: [Call propose_edits with insert at line 2]

User: "remove the introduction"
You: [Call propose_edits with delete]

User: "fix the equation"
You: [Call propose_edits with replace]

WORKFLOW:
1. User asks for edit → You call propose_edits immediately
2. Tool returns success → You say "Done! Added/changed X"
3. That's it. No manual instructions, no explaining what to do.

Line numbers below are 1-indexed. Match them exactly in your edits.

---
${numberedContent}
---${
    textFromEditor
      ? `

Selected text:
---
${textFromEditor}
---`
      : ''
  }${
    selectionRange
      ? `

Selection: lines ${selectionRange.startLineNumber}-${selectionRange.endLineNumber}`
      : ''
  }${projectSection}`;
}

/**
 * Build initialization prompt for report generation
 * @param reportInitState - The report initialization state with required fields and sections
 * @returns Formatted prompt for report generation
 */
export function buildInitializationPrompt(reportInitState: {
  required_fields: Record<string, string>;
  sections: Record<string, { content?: string; status?: string }>;
}): string {
  const completedSections = Object.entries(reportInitState.sections).filter(
    ([_, section]) => section.content
  );

  const prompt = `I need you to generate LaTeX code edits for a radiation test report based on the following information:

**Required Fields:**
${Object.entries(reportInitState.required_fields)
  .filter(([_, value]) => value)
  .map(([key, value]) => {
    const label = key
      .replace(/_/g, ' ')
      .replace(/\\b\\w/g, (l) => l.toUpperCase());
    return `- ${label}: ${value}`;
  })
  .join('\n')}

${
  completedSections.length > 0
    ? `**Additional Information:**
${completedSections
  .map(([key, section]) => {
    const label = key
      .replace(/_/g, ' ')
      .replace(/\\b\\w/g, (l) => l.toUpperCase());
    return `- ${label}: ${section.content}`;
  })
  .join('\n')}`
    : ''
}

Please generate appropriate edits for the report template files:
1. Update Inputs/inputs.tex with author information, DUT details, and facility settings
2. Generate content for relevant subsections based on the provided information
3. Ensure all LaTeX formatting is correct and follows the template structure`;

  return prompt;
}

/**
 * Build system prompt for image description/analysis
 * Used when extracting content from images for LaTeX documents
 * @returns System prompt for image analysis
 */
export function buildImageDescriptionPrompt(): string {
  return `You are an expert at analyzing images and extracting their content. Describe everything you see clearly and accurately.`;
}

/**
 * Build user prompt for image description
 * @param fileName: Name of the image file
 * @returns User prompt for image analysis
 */
export function buildImageDescriptionUserPrompt(fileName?: string): string {
  return `Describe everything you see in this image. If the image contains a plot, describe the plot clearly, including axes, labels, and any data points as well as the main features and insights. Be concise but accurate.\n\nImage: ${fileName || 'image'}`;
}

/**
 * Build prompt for integrating an uploaded image into a LaTeX file
 * @param imageDescription - The analyzed content/description of the image
 * @param imagePath - Path to the uploaded image file
 * @param subsectionPath - Path to the target LaTeX file
 * @param subsectionName - Display name of the subsection
 * @param subsectionContent - Current content of the target file
 * @param verbosity - Caption detail level: 'low', 'medium', or 'high'
 * @param comment - Optional additional instructions from user
 * @returns Formatted prompt for the agent
 */
export function buildImageIntegrationPrompt(
  imageDescription: string,
  imagePath: string,
  subsectionPath: string,
  subsectionName: string,
  subsectionContent: string,
  verbosity: 'low' | 'medium' | 'high',
  comment?: string
): string {
  const verbosityInstructions = {
    low: 'Keep the caption brief and concise - just the essential facts.',
    medium: 'Provide a standard caption with key observations and context.',
    high: 'Create a detailed, comprehensive caption explaining all visible elements, trends, and implications.',
  };

  let prompt = `I have uploaded an image and analyzed its content.

--- Image Content ---
${imageDescription}
--- End Image Content ---

Image file location: ${imagePath}

Please integrate this content into the following LaTeX file:

Target File: ${subsectionPath}
Subsection Name: ${subsectionName}

Current Content in this File:
\`\`\`latex
${subsectionContent || '(Empty file)'}
\`\`\`

Please suggest LaTeX code edits to:
1. Add an \\includegraphics command to reference the image file at: ${imagePath}
2. Include the analyzed content as a figure caption or surrounding text
3. Format it appropriately with proper LaTeX commands (\\begin{figure}, \\centering, \\caption, etc.)

Caption Verbosity: ${verbosityInstructions[verbosity]}`;

  if (comment) {
    prompt += `\n\nAdditional Instructions: ${comment}`;
  }

  return prompt;
}
