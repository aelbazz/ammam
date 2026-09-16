/**
 * Deliberately tiny budgets, set before AppModule is imported so the login route's
 * @Throttle decorator captures them at class-load time.
 */
process.env.THROTTLE_LIMIT = '1000';
process.env.AUTH_THROTTLE_LIMIT = '3';
process.env.THROTTLE_TTL_SECONDS = '60';
