import type { KeyPair } from "./primitives.js";

/**
 * X3DH (Extended Triple Diffie-Hellman) — initial key agreement, run once
 * per new session before the Double Ratchet takes over.
 *
 * STATUS: interface + types only. This monorepo task is about *structure*
 * (§5), not shipping a self-reviewed crypto core — the actual DH-chaining
 * and key-derivation steps (IK/SPK/OPK combination per the Signal spec)
 * are TODO and should land as its own reviewed change, not bundled into
 * scaffolding.
 */

export interface IdentityBundle {
  identityKey: Uint8Array; // IK — long-term
  signedPreKey: Uint8Array; // SPK
  signedPreKeySignature: Uint8Array;
  oneTimePreKey?: Uint8Array; // OPK — consumed on use
}

export interface X3dhSessionKeys {
  rootKey: Uint8Array;
  associatedData: Uint8Array;
}

export function generatePreKeyBundle(_identity: KeyPair): IdentityBundle {
  throw new Error("TODO: X3DH prekey bundle generation not yet implemented");
}

export function initiateSession(
  _ourIdentity: KeyPair,
  _theirBundle: IdentityBundle,
): X3dhSessionKeys {
  throw new Error("TODO: X3DH initiator flow not yet implemented");
}

export function respondToSession(
  _ourIdentity: KeyPair,
  _ourBundle: IdentityBundle,
  _theirIdentityKey: Uint8Array,
  _theirEphemeralKey: Uint8Array,
): X3dhSessionKeys {
  throw new Error("TODO: X3DH responder flow not yet implemented");
}
