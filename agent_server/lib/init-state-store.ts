/**
 * Init State Store
 *
 * Persistent storage for report initialization state using keyv with file backend.
 */

import Keyv from 'keyv';
import KeyvFile from 'keyv-file';
import path from 'path';

// Configure keyv with file backend
// Data stored in agent_server/data/init-states.json
const store = new Keyv({
  store: new KeyvFile({
    filename: path.join(__dirname, '../data/init-states.json'),
    writeDelay: 100, // Debounce writes
  }),
  namespace: 'init', // Prefix all keys with 'init:'
});

/**
 * Save initialization state for a user/session
 * @param userId - Unique identifier (user ID or session ID)
 * @param state - Report initialization state
 */
export async function saveInitState(userId: string, state: any): Promise<void> {
  await store.set(userId, state);
  console.log(`[InitStateStore] Saved state for user: ${userId}`);
}

/**
 * Load initialization state for a user/session
 * @param userId - Unique identifier (user ID or session ID)
 * @returns Initialization state or undefined if not found/expired
 */
export async function loadInitState(userId: string): Promise<any | undefined> {
  const state = await store.get(userId);
  if (state) {
    console.log(`[InitStateStore] Loaded state for user: ${userId}`);
  } else {
    console.log(`[InitStateStore] No state found for user: ${userId}`);
  }
  return state;
}

/**
 * Delete initialization state for a user/session
 * @param userId - Unique identifier (user ID or session ID)
 */
export async function deleteInitState(userId: string): Promise<boolean> {
  const deleted = await store.delete(userId);
  console.log(
    `[InitStateStore] ${deleted ? 'Deleted' : 'No state to delete for'} user: ${userId}`
  );
  return deleted;
}

/**
 * Clear all initialization states (for testing/cleanup)
 */
export async function clearAllInitStates(): Promise<void> {
  await store.clear();
  console.log('[InitStateStore] Cleared all initialization states');
}
