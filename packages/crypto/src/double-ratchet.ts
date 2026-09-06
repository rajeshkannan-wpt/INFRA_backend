/**
 * Double Ratchet — per-message forward secrecy + post-compromise security
 * for an established 1:1 session (output of x3dh.ts).
 *
 * STATUS: state shape + entry points only, chaining logic is TODO.
 * Same reasoning as x3dh.ts — this is the monorepo-structure task, the
 * ratchet's message-key derivation deserves a dedicated, reviewed PR.
 */

export interface RatchetState {
  rootKey: Uint8Array;
  sendingChainKey?: Uint8Array;
  receivingChainKey?: Uint8Array;
  sendingRatchetKey: Uint8Array;
  receivingRatchetKey?: Uint8Array;
  sendMessageNumber: number;
  receiveMessageNumber: number;
  skippedMessageKeys: Map<string, Uint8Array>;
}

export interface RatchetMessage {
  header: {
    ratchetKey: Uint8Array;
    messageNumber: number;
    previousChainLength: number;
  };
  ciphertext: Uint8Array;
}

export function initRatchet(_rootKey: Uint8Array, _isInitiator: boolean): RatchetState {
  throw new Error("TODO: ratchet initialization not yet implemented");
}

export function ratchetEncrypt(
  _state: RatchetState,
  _plaintext: Uint8Array,
): { state: RatchetState; message: RatchetMessage } {
  throw new Error("TODO: ratchet encrypt step not yet implemented");
}

export function ratchetDecrypt(
  _state: RatchetState,
  _message: RatchetMessage,
): { state: RatchetState; plaintext: Uint8Array } {
  throw new Error("TODO: ratchet decrypt step not yet implemented");
}
