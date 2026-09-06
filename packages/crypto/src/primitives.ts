import { utf8ToBytes } from "@noble/hashes/utils";
import { x25519, ed25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { chacha20poly1305 } from "@noble/ciphers/chacha";
import { randomBytes } from "@noble/hashes/utils";

/**
 * Everything in this file is pure JS with no native/WASM dependency, so it
 * runs identically in apps/backend (Node), apps/web (browser), and
 * apps/mobile (Hermes/React Native). That uniformity is *why* the
 * orchestration logic in x3dh.ts / double-ratchet.ts / sender-key.ts can
 * genuinely live once in this package instead of needing a per-platform
 * adapter — see ../README.md for how this compares to wrapping libsignal
 * directly.
 */

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export function generateIdentityKeyPair(): KeyPair {
  const privateKey = ed25519.utils.randomSecretKey();
  return { privateKey, publicKey: ed25519.getPublicKey(privateKey) };
}

export function generateX25519KeyPair(): KeyPair {
  const privateKey = x25519.utils.randomSecretKey();
  return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
}

export function diffieHellman(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(privateKey, publicKey);
}

export function sign(privateKey: Uint8Array, message: Uint8Array): Uint8Array {
  return ed25519.sign(message, privateKey);
}

export function verify(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array,
): boolean {
  return ed25519.verify(signature, message, publicKey);
}

export function deriveKeys(
  inputKeyMaterial: Uint8Array,
  info: string,
  outputLength: number,
  salt?: Uint8Array,
): Uint8Array {
  const infoBytes = utf8ToBytes(info);
  return hkdf(sha256, inputKeyMaterial, salt, infoBytes, outputLength);
}

export function aeadEncrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
  associatedData?: Uint8Array,
): Uint8Array {
  return chacha20poly1305(key, nonce, associatedData).encrypt(plaintext);
}

export function aeadDecrypt(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  associatedData?: Uint8Array,
): Uint8Array {
  return chacha20poly1305(key, nonce, associatedData).decrypt(ciphertext);
}

export function randomNonce(length = 12): Uint8Array {
  return randomBytes(length);
}
