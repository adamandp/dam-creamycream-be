import { RedisThrottlerStorage } from './redis-throttler.storage';
describe('Redis rate limiting', () => {
  it('returns shared counter and converts expiry to seconds', async () => {
    const evalFn = jest.fn().mockResolvedValue([121, 5000, 1, 60000]);
    const storage = new RedisThrottlerStorage({ eval: evalFn } as any);
    await expect(
      storage.increment('key', 60000, 120, 60000, 'default'),
    ).resolves.toEqual({
      totalHits: 121,
      timeToExpire: 5,
      isBlocked: true,
      timeToBlockExpire: 60,
    });
    expect(evalFn).toHaveBeenCalledTimes(1);
  });
  it('fails closed if Redis is unavailable', async () => {
    const storage = new RedisThrottlerStorage({
      eval: jest.fn().mockRejectedValue(new Error()),
    } as any);
    await expect(
      storage.increment('key', 60000, 120, 60000, 'default'),
    ).rejects.toMatchObject({ status: 503 });
  });
});
