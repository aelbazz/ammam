import { TenantStatus } from '@prisma/client';
import { TenantLifecycleService } from './tenant-lifecycle.service';

describe('TenantLifecycleService', () => {
  const service = new TenantLifecycleService();
  const { PENDING, ACTIVE, SUSPENDED, ARCHIVED } = TenantStatus;

  it('allows the same status as a no-op', () => {
    expect(() => service.assertTransition(ACTIVE, ACTIVE)).not.toThrow();
    expect(() => service.assertTransition(ARCHIVED, ARCHIVED)).not.toThrow();
  });

  it.each([
    [PENDING, ACTIVE],
    [PENDING, ARCHIVED],
    [ACTIVE, SUSPENDED],
    [ACTIVE, ARCHIVED],
    [SUSPENDED, ACTIVE],
    [SUSPENDED, ARCHIVED],
  ])('allows %s -> %s', (from, to) => {
    expect(() => service.assertTransition(from, to)).not.toThrow();
  });

  it.each([
    [PENDING, SUSPENDED],
    [ARCHIVED, ACTIVE],
    [ARCHIVED, PENDING],
    [ARCHIVED, SUSPENDED],
  ])('rejects %s -> %s', (from, to) => {
    expect(() => service.assertTransition(from, to)).toThrow();
  });

  it('ARCHIVED is terminal - nothing transitions out of it', () => {
    for (const to of [PENDING, ACTIVE, SUSPENDED] as const) {
      expect(() => service.assertTransition(ARCHIVED, to)).toThrow();
    }
  });
});
