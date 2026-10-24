import { generateKeyPair, exportJWK, SignJWT } from 'jose';
let fixture;
export async function identityFixture() {
  return fixture ||= (async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const key = { ...await exportJWK(publicKey), kid: 'ephemeral-test-key', alg: 'RS256', use: 'sig' };
    const project = 'fixture-firebase-project';
    return { publicKey, privateKey, project, jwks: { keys: [key] },
      async token(uid = 'fixture-user-a', claims = {}, header = {}) {
        const now = Math.floor(Date.now() / 1000);
        return new SignJWT({ sub: uid, iss: `https://securetoken.google.com/${project}`, aud: project,
          iat: now, exp: now + 3600, auth_time: now - 1, ...claims })
          .setProtectedHeader({ alg: 'RS256', kid: key.kid, typ: 'JWT', ...header }).sign(privateKey);
      } };
  })();
}
