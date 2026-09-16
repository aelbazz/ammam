/**
 * Runs before any application module is imported.
 *
 * The login route's @Throttle decorator reads AUTH_THROTTLE_LIMIT when its class is first
 * loaded, so raising the budget inside beforeAll() would be too late - the decorator has
 * already captured the default. Setting it here keeps the suite's own repeated logins from
 * tripping the limiter. The limiter's real behaviour is asserted in its own test, which
 * sets an explicit low limit.
 */
process.env.THROTTLE_LIMIT = process.env.THROTTLE_LIMIT ?? '100000';
process.env.AUTH_THROTTLE_LIMIT = process.env.AUTH_THROTTLE_LIMIT ?? '100000';
