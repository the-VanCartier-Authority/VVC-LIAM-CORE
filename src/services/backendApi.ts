import { auth } from './googleAuth';
import { createAuthenticatedFetch } from '../core/authenticatedFetch';

export const backendFetch = createAuthenticatedFetch(
  async () => {
    const user = auth.currentUser;
    if (!user) return null;
    const token = await user.getIdToken();
    if (auth.currentUser !== user) throw new Error('AUTH_REQUIRED');
    return token;
  },
  () => window.location.origin,
);
