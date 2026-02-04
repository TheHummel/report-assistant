import { describe, it, expect } from 'vitest';
import { buildRedirectUrl, resolveRedirectBase } from '../redirect';

describe('Redirect URL handling', () => {
  it('prefers the direct host header over forwarded host', () => {
    const headers = new Headers({
      host: 'ai-latex-editor.example.com',
      'x-forwarded-host': 'tools.example.com',
      'x-forwarded-proto': 'https',
    });

    const base = resolveRedirectBase(headers, new URL('https://ai-latex-editor.example.com/auth/oauth'));
    expect(base.origin).toBe('https://ai-latex-editor.example.com');

    const redirect = buildRedirectUrl(headers, 'https://ai-latex-editor.example.com', '/projects/123');
    expect(redirect).toBe('https://ai-latex-editor.example.com/projects/123');
  });

  it('falls back to origin host when proxy host differs', () => {
    const headers = new Headers({
      host: 'tools.example.com',
      'x-forwarded-host': 'app.example.com',
      'x-forwarded-proto': 'https',
    });

    const base = resolveRedirectBase(headers, new URL('https://app.example.com/auth/oauth'));
    expect(base.origin).toBe('https://app.example.com');

    const redirect = buildRedirectUrl(headers, 'https://app.example.com', '/projects/123');
    expect(redirect).toBe('https://app.example.com/projects/123');
  });

  it('falls back to forwarded host when allow-listed', () => {
    const headers = new Headers({
      'x-forwarded-host': 'preview.ai-latex-editor.vercel.app',
      'x-forwarded-proto': 'https',
    });

    const base = resolveRedirectBase(
      headers,
      new URL('https://ai-latex-editor.example.com/auth/oauth'),
      'preview.ai-latex-editor.vercel.app'
    );
    expect(base.origin).toBe('https://preview.ai-latex-editor.vercel.app');

    const redirect = buildRedirectUrl(
      headers,
      'https://ai-latex-editor.example.com',
      '/projects/123',
      'preview.ai-latex-editor.vercel.app'
    );
    expect(redirect).toBe('https://preview.ai-latex-editor.vercel.app/projects/123');
  });

  it('defaults to origin host when no candidate is allow-listed', () => {
    const headers = new Headers({
      host: 'internal.vercel.app',
      'x-forwarded-host': 'example.com',
      'x-forwarded-proto': 'https',
    });

    const base = resolveRedirectBase(headers, new URL('https://ai-latex-editor.example.com/auth/oauth'));
    expect(base.origin).toBe('https://ai-latex-editor.example.com');
  });
});
