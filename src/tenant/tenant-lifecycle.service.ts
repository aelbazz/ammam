import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantStatus } from '@prisma/client';

/**
 * The allowed status transition graph. A transition not listed here is rejected - the
 * lifecycle is PENDING -> ACTIVE -> {SUSPENDED <-> ACTIVE} -> ARCHIVED, with ARCHIVED as a
 * terminal state (matching soft-delete semantics: nothing reactivates an archived tenant).
 */
const ALLOWED_TRANSITIONS: Record<TenantStatus, ReadonlySet<TenantStatus>> = {
  [TenantStatus.PENDING]: new Set([TenantStatus.ACTIVE, TenantStatus.ARCHIVED]),
  [TenantStatus.ACTIVE]: new Set([TenantStatus.SUSPENDED, TenantStatus.ARCHIVED]),
  [TenantStatus.SUSPENDED]: new Set([TenantStatus.ACTIVE, TenantStatus.ARCHIVED]),
  [TenantStatus.ARCHIVED]: new Set([]),
};

@Injectable()
export class TenantLifecycleService {
  /** Throws if `to` is not a valid next state from `from`. */
  assertTransition(from: TenantStatus, to: TenantStatus): void {
    if (from === to) {
      return; // setting the same status is a harmless no-op, not an error
    }
    if (!ALLOWED_TRANSITIONS[from].has(to)) {
      throw new BadRequestException(
        `Cannot move a tenant from ${from} to ${to}. Allowed from ${from}: ` +
          `${[...ALLOWED_TRANSITIONS[from]].join(', ') || '(none - terminal state)'}.`,
      );
    }
  }
}
