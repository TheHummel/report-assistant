import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSSEHeaders } from '@/lib/octra-agent/stream-handling';

// Disable quota checks
const DISABLE_QUOTA_CHECKS = true;

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to use AI features.' },
        { status: 401 }
      );
    }

    // Skip quota checks when disabled
    if (DISABLE_QUOTA_CHECKS) {
      console.log(
        `[Init Proxy] Quota checks disabled, allowing request for user: ${user.email}`
      );
    }

    const remoteUrl = process.env.AGENT_SERVICE_URL;
    if (!remoteUrl) {
      console.error('[Init Proxy] AGENT_SERVICE_URL is not configured');
      return NextResponse.json(
        {
          error: 'Agent service unavailable',
          details: 'AGENT_SERVICE_URL is not configured on the server',
        },
        { status: 503 }
      );
    }

    const body = await request.json();

    // Add userId from auth to the request
    const bodyWithUserId = {
      ...body,
      userId: user.id,
    };

    console.log(
      '[Init Proxy] Forwarding init request to agent server:',
      `${remoteUrl}/init`
    );

    const res = await fetch(`${remoteUrl}/init`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify(bodyWithUserId),
    });

    if (!res.ok || !res.body) {
      console.error(
        '[Init Proxy] Remote server failed:',
        res.status,
        res.statusText
      );
      return NextResponse.json(
        { error: 'Remote init service failed', status: res.status },
        { status: 502 }
      );
    }

    console.log('[Init Proxy] Streaming response from remote server...');

    // Create a transform stream to log events as they pass through
    const { readable, writable } = new TransformStream();
    const reader = res.body.getReader();
    const writer = writable.getWriter();
    const decoder = new TextDecoder();

    // Stream and log events
    (async () => {
      try {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Pass through immediately
          await writer.write(value);

          // Log events for debugging
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Parse complete events (separated by \n\n)
          let sepIndex;
          while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
            const event = buffer.slice(0, sepIndex);
            buffer = buffer.slice(sepIndex + 2);

            // Log the event type
            const eventMatch = event.match(/event:\s*(\S+)/);
            if (eventMatch) {
              const eventType = eventMatch[1];
              console.log(`[Init Proxy] Event received: ${eventType}`);
            }
          }
        }
        // Close writer if not already closed
        try {
          await writer.close();
        } catch (e) {
          // Writer already closed, ignore
        }
      } catch (err) {
        // Ignore abort errors (expected when client stops)
        const error = err as Error;
        if (
          error?.name === 'AbortError' ||
          error?.constructor?.name === 'ResponseAborted'
        ) {
          console.log('[Init Proxy] Stream aborted by client');
        } else {
          console.error('[Init Proxy] Stream error:', err);
        }
        // Try to abort writer if not already closed
        try {
          await writer.abort();
        } catch {
          // Already closed, ignore
        }
      } finally {
        // Clean up reader
        try {
          await reader.cancel();
        } catch {
          // Already cancelled, ignore
        }
      }
    })();

    return new Response(readable, { headers: createSSEHeaders() });
  } catch (error) {
    console.error('Init service error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process init request', details: message },
      { status: 500 }
    );
  }
}
