export { issueAccessToken, verifyAccessToken, decodeAccessTokenUnsafe } from "./jwt.js";
export { issueAdminToken, verifyAdminToken } from "./jwt.js";
export type { AccessTokenPayload, IssueAccessTokenParams } from "./types.js";

export {
  issueRefreshToken,
  validateRefreshToken,
  revokeSession,
  revokeAllUserSessions,
} from "./refresh-token.js";
export type { IssueRefreshTokenResult, ValidatedSession } from "./refresh-token.js";

export {
  recordLegalAcceptance,
  hasAcceptedLegal,
  requireLegalAcceptance,
  LegalAcceptanceRequiredError,
} from "./legal-gate.js";
