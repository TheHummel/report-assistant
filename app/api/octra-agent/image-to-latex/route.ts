import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { image, fileName } = await request.json();

    if (!image) {
      return new Response('Image is required', { status: 400 });
    }

    // ensure image is in data URL format
    const imageDataUrl = image.startsWith('data:')
      ? image
      : `data:image/jpeg;base64,${image}`;

    // call CERN LiteLLM API with vision support
    const CERN_LITELLM_API_BASE_URL = process.env.CERN_LITELLM_API_BASE_URL;
    const CERN_LITELLM_API_KEY = process.env.CERN_LITELLM_API_KEY;
    const CERN_LITELLM_VISION_MODEL = process.env.CERN_LITELLM_VISION_MODEL!;

    if (!CERN_LITELLM_API_BASE_URL || !CERN_LITELLM_API_KEY || !CERN_LITELLM_VISION_MODEL) {
      console.error(
        '[Image-to-LaTeX] Missing required environment variables:',
        {
          hasBaseUrl: !!CERN_LITELLM_API_BASE_URL,
          hasApiKey: !!CERN_LITELLM_API_KEY,
          hasVisionModel: !!CERN_LITELLM_VISION_MODEL,
        }
      );
      return new Response(
        'CERN LiteLLM configuration missing. Please check CERN_LITELLM_API_BASE_URL, CERN_LITELLM_API_KEY and CERN_LITELLM_VISION_MODEL environment variables.',
        { status: 503 }
      );
    }

    const systemPrompt = `You are an expert at analyzing images and extracting their content. Describe everything you see clearly and accurately.`;

    const response = await fetch(`${CERN_LITELLM_API_BASE_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': CERN_LITELLM_API_KEY,
      },
      body: JSON.stringify({
        model: CERN_LITELLM_VISION_MODEL,
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
                text: `Describe everything you see in this image. If the image contains a plot, describe the plot clearly, including axes, labels, and any data points as well as the main features and insights. Be concise but accurate.\n\nImage: ${fileName || 'image'}`,
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

      return new Response(
        `Failed to process image: ${response.status} ${errorText}`,
        {
          status: 500,
        }
      );
    }
    // parse response
    const data = await response.json();
    let content = '';

    if (data.choices?.[0]?.message?.content) {
      content = data.choices[0].message.content;
    }
    // check for wrapped format
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
      return new Response('No content extracted from image', { status: 500 });
    }

    return new Response(content, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[Image-to-LaTeX] Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return new Response(`Internal server error: ${errorMessage}`, {
      status: 500,
    });
  }
}
