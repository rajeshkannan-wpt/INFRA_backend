/**
 * Sender Key — group messaging efficiency layer on top of pairwise
 * Double Ratchet sessions (each sender distributes one symmetric chain
 * key to the group instead of ratcheting per-recipient per-message).
 *
 * STATUS: interface only, distribution + chain-ratchet logic is TODO.
 */

export interface SenderKeyState {
  chainKey: Uint8Array;
  signingKeyPair: { publicKey: Uint8Array; privateKey: Uint8Array };
  iteration: number;
}

export interface SenderKeyDistributionMessage {
  chainKey: Uint8Array;
  signingPublicKey: Uint8Array;
  iteration: number;
}

export function createSenderKey(): SenderKeyState {
  throw new Error("TODO: sender key creation not yet implemented");
}

export function distributeSenderKey(_state: SenderKeyState): SenderKeyDistributionMessage {
  throw new Error("TODO: sender key distribution not yet implemented");
}

export function senderKeyEncrypt(
  _state: SenderKeyState,
  _plaintext: Uint8Array,
): { state: SenderKeyState; ciphertext: Uint8Array } {
  throw new Error("TODO: sender key encrypt not yet implemented");
}

export function senderKeyDecrypt(
  _state: SenderKeyState,
  _ciphertext: Uint8Array,
): { state: SenderKeyState; plaintext: Uint8Array } {
  throw new Error("TODO: sender key decrypt not yet implemented");
}
