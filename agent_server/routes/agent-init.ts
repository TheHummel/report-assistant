/**
 * Report Initialization Route
 * Handles report initialization with deterministic edits
 */

import { Router, Request, Response } from 'express';
import { generateInitializationEdits } from '../lib/octra-agent/report-initialization';
import { loadInitState, saveInitState } from '../lib/init-state-store';
import { INIT_TARGET_FILES } from '@shared/report-init-config';
import type { LineEdit } from '../lib/octra-agent/line-edits';

export function createAgentInitRouter(): Router {
  const router = Router();

  router.post('/init', async (req: Request, res: Response) => {
    try {
      const { reportInitState, projectFiles, projectId, userId } =
        req.body || {};

      if (!reportInitState || typeof reportInitState !== 'object') {
        return res.status(400).json({
          error: 'reportInitState is required',
        });
      }

      if (!Array.isArray(projectFiles) || projectFiles.length === 0) {
        return res.status(400).json({
          error: 'projectFiles is required (filtered text files only)',
        });
      }

      const stateKey = projectId || userId || 'default';

      console.log('[Init] Generating edits for:', stateKey);

      // find all target files from INIT_TARGET_FILES
      const targetFiles = projectFiles.filter((file) =>
        INIT_TARGET_FILES.some(
          (targetPath) =>
            file.path === targetPath || file.path.endsWith(`/${targetPath}`)
        )
      );

      if (targetFiles.length === 0) {
        return res.status(404).json({
          error: `No target files found. Expected: ${INIT_TARGET_FILES.join(', ')}`,
          hint: 'Make sure target files are included in projectFiles',
        });
      }

      console.log(
        `[Init] Found ${targetFiles.length} target file(s):`,
        targetFiles.map((f) => f.path)
      );

      // set up SSE response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const writeEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      writeEvent('status', { state: 'started' });

      // --- DETERMINISTIC EDITS ---
      const allEdits: LineEdit[] = [];

      for (const targetFile of targetFiles) {
        const edits = generateInitializationEdits(
          reportInitState,
          targetFile.content,
          targetFile.path
        );

        edits.forEach((edit) => {
          if (!edit.filePath) {
            edit.filePath = targetFile.path;
          }
        });

        allEdits.push(...edits);
      }

      // TODO: refine edits with CERN LiteLLM + GenAI edits for sections information provided from user

      console.log(`[Init] Generated ${allEdits.length} total edits`);

      // store state for later reference by agent
      await saveInitState(stateKey, reportInitState);

      // emit edits
      if (allEdits.length > 0) {
        writeEvent('tool', {
          name: 'propose_edits',
          count: allEdits.length,
        });
        writeEvent('edits', allEdits);
      }

      // send completion
      writeEvent('done', {
        text: `Generated ${allEdits.length} initialization edits for ${targetFiles.length} file(s). State saved for project.`,
      });

      res.end();
    } catch (error) {
      console.error('[Init] Error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to generate initialization edits',
          details: message,
        });
      } else {
        res.write(`event: error\n`);
        res.write(`data: ${JSON.stringify({ message })}\n\n`);
        res.end();
      }
    }
  });

  // GET /init/:key - Retrieve stored initialization state
  router.get('/init/:key', async (req: Request, res: Response) => {
    try {
      const { key } = req.params;

      if (!key) {
        return res.status(400).json({ error: 'State key is required' });
      }

      const state = await loadInitState(key);

      if (!state) {
        return res.status(404).json({
          error: 'No initialization state found for this key',
        });
      }

      return res.json({ state });
    } catch (error) {
      console.error('[Init] Error loading state:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({
        error: 'Failed to load initialization state',
        details: message,
      });
    }
  });

  return router;
}
