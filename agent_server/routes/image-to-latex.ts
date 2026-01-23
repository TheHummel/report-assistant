/**
 * Image-to-LaTeX Route
 * Handles image description requests using CERN LiteLLM API
 */

import { Router, Request, Response } from 'express';
import {
  buildImageDescriptionPrompt,
  buildImageDescriptionUserPrompt,
} from '../lib/octra-agent/content-processing';

interface ImageToLatexConfig {
  cernLiteLLMUrl: string;
  cernLiteLLMApiKey: string;
  cernLiteLLMVisionModel: string;
}

export function createImageToLatexRouter(config: ImageToLatexConfig): Router {
  const router = Router();

  router.post('/image-to-latex', async (req: Request, res: Response) => {
    try {
      const { image, fileName } = req.body;

      if (!image) {
        return res.status(400).send('Image is required');
      }

      // Ensure image is in data URL format
      const imageDataUrl = image.startsWith('data:')
        ? image
        : `data:image/jpeg;base64,${image}`;

      // Validate config
      if (
        !config.cernLiteLLMUrl ||
        !config.cernLiteLLMApiKey ||
        !config.cernLiteLLMVisionModel
      ) {
        console.error('[Image-to-LaTeX] Missing required configuration:', {
          hasApiUrl: !!config.cernLiteLLMUrl,
          hasApiKey: !!config.cernLiteLLMApiKey,
          hasVisionModel: !!config.cernLiteLLMVisionModel,
        });
        return res
          .status(503)
          .send(
            'CERN LiteLLM configuration missing. Please check CERN_LITELLM_URL, CERN_LITELLM_API_KEY and CERN_LITELLM_VISION_MODEL environment variables.'
          );
      }

      // Build prompts using centralized functions
      const systemPrompt = buildImageDescriptionPrompt();
      const userPromptText = buildImageDescriptionUserPrompt(fileName);

      // Call CERN LiteLLM Vision API
      const response = await fetch(config.cernLiteLLMUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.cernLiteLLMApiKey,
        },
        body: JSON.stringify({
          model: config.cernLiteLLMVisionModel,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: userPromptText,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageDataUrl,
                  },
                },
              ],
            },
          ],
          max_tokens: 512,
          temperature: 0.1,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Image-to-LaTeX] CERN LiteLLM API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });

        return res
          .status(500)
          .send(`Failed to process image: ${response.status} ${errorText}`);
      }

      // Parse response
      const data = (await response.json()) as any;
      let content = '';

      if (data.choices?.[0]?.message?.content) {
        content = data.choices[0].message.content;
      }
      // Check for wrapped format
      else if (data.steps?.[0]?.content) {
        const step = data.steps[0];
        const textContent = step.content.find((c: any) => c.type === 'text');
        content = textContent?.text || '';
      } else if (
        data.steps?.[0]?.response?.body?.choices?.[0]?.message?.content
      ) {
        content = data.steps[0].response.body.choices[0].message.content;
      }

      if (!content) {
        console.error('[Image-to-LaTeX] No content in response:', data);
        return res.status(500).send('No content extracted from image');
      }

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(content);
    } catch (error) {
      console.error('[Image-to-LaTeX] Error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      res.status(500).send(`Internal server error: ${errorMessage}`);
    }
  });

  return router;
}
