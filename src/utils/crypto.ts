/**
 * End-to-End Encryption (E2EE) Module
 * Implements 256-bit AES-GCM with PBKDF2 key derivation using Web Crypto API.
 * Provides Zero-Knowledge security: data is encrypted client-side before storage or transmission.
 */

// Convert ArrayBuffer to Base64
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Base64 to ArrayBuffer
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate random salt
export function generateSalt(length = 16): string {
  const salt = window.crypto.getRandomValues(new Uint8Array(length));
  return bufferToBase64(salt.buffer);
}

// Generate random IV
export function generateIV(length = 12): string {
  const iv = window.crypto.getRandomValues(new Uint8Array(length));
  return bufferToBase64(iv.buffer);
}

// Derive AES-GCM key from passphrase and salt using PBKDF2
export async function deriveKey(passphrase: string, saltBase64: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const salt = base64ToBuffer(saltBase64);

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt plaintext with AES-GCM 256-bit
export async function encryptText(plaintext: string, passphrase: string): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const salt = generateSalt();
  const iv = generateIV();
  const key = await deriveKey(passphrase, salt);

  const enc = new TextEncoder();
  const encodedPlaintext = enc.encode(plaintext);

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(base64ToBuffer(iv)),
    },
    key,
    encodedPlaintext
  );

  return {
    ciphertext: bufferToBase64(encrypted),
    iv,
    salt,
  };
}

// Decrypt ciphertext with AES-GCM 256-bit
export async function decryptText(ciphertextBase64: string, ivBase64: string, saltBase64: string, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, saltBase64);
  const ciphertext = base64ToBuffer(ciphertextBase64);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(base64ToBuffer(ivBase64)),
    },
    key,
    ciphertext
  );

  const dec = new TextDecoder();
  return dec.decode(decrypted);
}

// Compute SHA-256 fingerprint for E2EE display
export async function computeFingerprint(passphrase: string): Promise<string> {
  const enc = new TextEncoder();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', enc.encode(passphrase));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  // Return formatted fingerprint in 4-character blocks
  return hex.match(/.{1,4}/g)?.slice(0, 6).join(':') || hex.substring(0, 24);
}
