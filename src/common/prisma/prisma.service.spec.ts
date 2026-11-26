import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
describe('Prisma connection configuration', () => {
  it('rejects non PostgreSQL connection URLs', () =>
    expect(
      () =>
        new PrismaService(
          new ConfigService({ DATABASE_URL: 'http://example.test' }),
        ),
    ).toThrow());
});
