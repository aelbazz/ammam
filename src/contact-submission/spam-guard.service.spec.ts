import { HeuristicSpamGuardService } from './spam-guard.service';

describe('HeuristicSpamGuardService', () => {
  let guard: HeuristicSpamGuardService;

  beforeEach(() => {
    guard = new HeuristicSpamGuardService();
  });

  it('allows a submission with no honeypot and no timing info', () => {
    expect(guard.evaluate({})).toEqual({ allowed: true });
  });

  it('allows a submission that took a plausible amount of time to fill', () => {
    const formLoadedAt = new Date(Date.now() - 10_000).toISOString();
    expect(guard.evaluate({ formLoadedAt })).toEqual({ allowed: true });
  });

  it('rejects a submission with a filled honeypot', () => {
    const result = guard.evaluate({ honeypot: 'I am a bot' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('honeypot');
  });

  it('rejects a submission filled faster than a human plausibly could', () => {
    const formLoadedAt = new Date(Date.now() - 500).toISOString();
    const result = guard.evaluate({ formLoadedAt });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('too-fast');
  });

  it('ignores an unparseable formLoadedAt rather than rejecting on a client bug', () => {
    expect(guard.evaluate({ formLoadedAt: 'not-a-date' })).toEqual({ allowed: true });
  });

  it('checks the honeypot before timing, so both reasons never race', () => {
    const formLoadedAt = new Date(Date.now() - 500).toISOString();
    const result = guard.evaluate({ honeypot: 'x', formLoadedAt });
    expect(result.reason).toBe('honeypot');
  });
});
