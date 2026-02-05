'use server';

import { getCurrentUser } from '@/lib/requests/user';

export { getCurrentUser };

export async function getUser() {
  return await getCurrentUser();
}
