import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import type { Request, RequestHandler } from 'express';

export interface FirebaseIdentity { uid: string; authTime: number; issuedAt: number }
declare global { namespace Express { interface Request { auth?: FirebaseIdentity } } }

const firebaseKeysURL = new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
const publicReads = new Set(['/config', '/push/vapid-public-key', '/vaos/health']);

export function createFirebaseVerifier(projectId: string, keys: JWTVerifyGetKey = createRemoteJWKSet(firebaseKeysURL, {
  timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 600000,
})) {
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) throw new Error('FIREBASE_PROJECT_ID_REQUIRED');
  return async (token: string): Promise<FirebaseIdentity> => {
    if (!token || token.length > 8192) throw new Error('INVALID_ID_TOKEN');
    const { payload, protectedHeader } = await jwtVerify(token, keys, {
      algorithms: ['RS256'], issuer: `https://securetoken.google.com/${projectId}`, audience: projectId,
      requiredClaims: ['sub', 'iat', 'exp', 'auth_time'], maxTokenAge: '1h', clockTolerance: 0,
    });
    const now = Math.floor(Date.now() / 1000);
    if (!protectedHeader.kid || (protectedHeader.typ !== undefined && protectedHeader.typ !== 'JWT') ||
        typeof payload.sub !== 'string' || !payload.sub.length || payload.sub.length > 128 ||
        payload.aud !== projectId || typeof payload.auth_time !== 'number' || !Number.isInteger(payload.auth_time) ||
        payload.auth_time < 0 || payload.auth_time > now ||
        !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.iat! > now || payload.auth_time > payload.iat! ||
        payload.exp! <= payload.iat! || payload.exp! - payload.iat! > 3600) throw new Error('INVALID_ID_TOKEN');
    return Object.freeze({ uid: payload.sub, authTime: payload.auth_time, issuedAt: payload.iat! });
  };
}

export function firebaseIdentityMiddleware(verify: (token: string) => Promise<FirebaseIdentity>): RequestHandler {
  return async (req: Request, res, next) => {
    if (req.method === 'GET' && publicReads.has(req.path)) return next();
    const authorization = req.headers.authorization;
    const authorizationCount = req.rawHeaders.filter((_, i) => i % 2 === 0)
      .filter(name => name.toLowerCase() === 'authorization').length;
    const match = typeof authorization === 'string' && /^Bearer ([A-Za-z0-9_\-.]+)$/i.exec(authorization);
    if (authorizationCount !== 1 || !match || match[1].length > 8192) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Se requiere una sesión válida.' });
    }
    try {
      const identity = await verify(match[1]);
      Object.defineProperty(req, 'auth', { value: identity, writable: false, configurable: false });
      return next();
    } catch {
      // Do not log the token, decoded claims, network exception, or provider body.
      res.setHeader('WWW-Authenticate', 'Bearer');
      return res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Se requiere una sesión válida.' });
    }
  };
}
