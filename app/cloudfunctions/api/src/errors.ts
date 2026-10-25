export type ErrorCode =
  | 'NOT_LOGGED_IN'
  | 'NOT_MEMBER'
  | 'ALREADY_IN_TEAM'
  | 'TEAM_FULL'
  | 'TEAM_ENDED'
  | 'NOT_IN_PLAN'
  | 'LOCKED'
  | 'DUPLICATE'
  | 'MOOD_LIMIT'
  | 'BAD_INPUT'
  | 'INTERNAL'

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message)
  }
}

export const fail = (code: ErrorCode, message: string, extra?: Record<string, unknown>): never => {
  throw new AppError(code, message, extra)
}
