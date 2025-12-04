import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Import helper modules
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

    // Skip all quota checks when disabled
    if (DISABLE_QUOTA_CHECKS) {
      console.log(
        `[Octra Proxy] Quota checks disabled, allowing request for user: ${user.email}`
      );
    }

    const remoteUrl = process.env.AGENT_SERVICE_URL;
    if (!remoteUrl) {
      console.error('[Octra Proxy] AGENT_SERVICE_URL is not configured');
      return NextResponse.json(
        {
          error: 'Agent service unavailable',
          details: 'AGENT_SERVICE_URL is not configured on the server',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    console.log(
      '[Octra Proxy] Forwarding authenticated request to agent server:',
      remoteUrl
    );

    const res = await fetch(remoteUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      console.error(
        '[Octra Proxy] Remote server failed:',
        res.status,
        res.statusText
      );
      return NextResponse.json(
        { error: 'Remote agent service failed', status: res.status },
        { status: 502 }
      );
    }

    console.log('[Octra Proxy] Streaming response from remote server...');

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
            const dataMatch = event.match(/data:\s*([\s\S]+)/);
            if (eventMatch) {
              const eventType = eventMatch[1];
              console.log(`[Octra Proxy] Event received: ${eventType}`);

              // Log tool events in detail
              if (eventType === 'tool' && dataMatch) {
                try {
                  const data = JSON.parse(dataMatch[1]);
                  console.log(
                    `[Octra Proxy] Tool called: ${data.name}, count: ${data.count || 0}`
                  );
                } catch {}
              }
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
          console.log('[Octra Proxy] Stream aborted by client');
        } else {
          console.error('[Octra Proxy] Stream error:', err);
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
    console.error('Octra Agent SDK error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process agent request', details: message },
      { status: 500 }
    );
  }
}
