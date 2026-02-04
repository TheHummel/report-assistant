/**
 * Image Content Extractor
 * Uses GPT-4o-mini to describe image content before sending to Claude
 */

export interface ImageToLatexResult {
  success: boolean;
  latex?: string; // Named 'latex' for backward compatibility, but contains any text content
  error?: string;
}

/**
 * Extract content from an image using CERN LiteLLM API
 * @param imageDataUrl - Data URL of the image (data:image/png;base64,...)
 * @param fileName - Name of the file for context
 * @returns Text description of image content
 */
export async function convertImageToLatex(
  imageDataUrl: string,
  fileName: string
): Promise<ImageToLatexResult> {
  try {
    const response = await fetch('/api/lars-agent/image-to-latex', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageDataUrl,
        fileName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[convertImageToLatex] API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return {
        success: false,
        error: `Failed to convert image: ${response.status} - ${errorText || response.statusText}`,
      };
    }

    // read the non-streaming response
    const latex = await response.text();

    return {
      success: true,
      latex: latex.trim(),
    };
  } catch (error) {
    console.error('[convertImageToLatex] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Convert multiple images to LaTeX
 */
export async function convertImagesToLatex(
  images: Array<{ dataUrl: string; fileName: string }>
): Promise<Array<ImageToLatexResult & { fileName: string }>> {
  const results = await Promise.all(
    images.map(async ({ dataUrl, fileName }) => {
      const result = await convertImageToLatex(dataUrl, fileName);
      return { ...result, fileName };
    })
  );

  return results;
}
