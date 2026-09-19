import { Injectable } from '@nestjs/common';

export interface SpamCheckInput {
  /** A form field that must arrive empty - a bot filling every field trips this. */
  honeypot?: string;
  /** ISO timestamp the client captured when the form first rendered. */
  formLoadedAt?: string;
}

export interface SpamCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Decides whether a contact-form submission should be accepted. An abstract class rather
 * than an interface so it can be a Nest injection token: swap the binding in
 * ContactSubmissionModule for a real reCAPTCHA/hCaptcha-backed implementation later without
 * touching the controller or service that calls it.
 */
export abstract class SpamGuardService {
  abstract evaluate(input: SpamCheckInput): SpamCheckResult;
}

/** Minimum time a human needs to read and fill the form - a bot submits near-instantly. */
const MIN_FILL_TIME_MS = 3_000;

/**
 * Zero-dependency default: a hidden honeypot field plus a fill-time floor. Catches
 * unsophisticated bots without requiring a third-party CAPTCHA key from day one.
 */
@Injectable()
export class HeuristicSpamGuardService extends SpamGuardService {
  evaluate(input: SpamCheckInput): SpamCheckResult {
    if (input.honeypot) {
      return { allowed: false, reason: 'honeypot' };
    }

    if (input.formLoadedAt) {
      const loadedAt = Date.parse(input.formLoadedAt);
      if (!Number.isNaN(loadedAt) && Date.now() - loadedAt < MIN_FILL_TIME_MS) {
        return { allowed: false, reason: 'too-fast' };
      }
    }

    return { allowed: true };
  }
}
