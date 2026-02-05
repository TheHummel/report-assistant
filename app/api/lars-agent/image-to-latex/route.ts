import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/requests/user';

/**
 * Image-to-LaTeX API Route (Proxy to Agent Server)
 *
 * This route proxies image description requests to the agent server.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getCurrentUser();

    if (!user) {
      return new Response('Unauthorized. Please log in to use AI features.', {
        status: 401,
      });
    }

    const { image, fileName } = await request.json();

    if (!image) {
      return new Response('Image is required', { status: 400 });
    }

    const agentServerUrl = process.env.AGENT_SERVICE_URL;
    if (!agentServerUrl) {
      console.error('[Image-to-LaTeX Proxy] AGENT_SERVICE_URL not configured');
      return new Response(
        'Agent service unavailable. Please configure AGENT_SERVICE_URL.',
        { status: 503 }
      );
    }

    const imageToLatexUrl = `${agentServerUrl}/image-to-latex`;

    // Forward request to agent server
    const response = await fetch(imageToLatexUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image,
        fileName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Image-to-LaTeX Proxy] Agent server error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });

      return new Response(
        `Failed to process image: ${response.status} ${errorText}`,
        { status: response.status }
      );
    }

    // Forward response from agent server
    const content = await response.text();

    return new Response(content, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('[Image-to-LaTeX Proxy] Error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return new Response(`Internal server error: ${errorMessage}`, {
      status: 500,
    });
  }
}
