import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { generateKeyPairSync, randomUUID, createHmac } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import axios from 'axios';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/app.config';
import { PaymentsService } from '../src/model/payments/payments.service';
import { buildOpenApiDocument } from '../src/config/openapi.config';

describe('Checkout/payment HTTP pipeline (isolated services)', () => {
  let app: NestExpressApplication, db: PrismaService;
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const customer = randomUUID(),
    other = randomUUID();
  const secret = 'test-webhook-secret';
  const paymentInput = {
    paymentMethod: 'QRIS',
    customer: {
      name: 'Fixture',
      email: 'fixture@example.com',
      phone: '08123456789',
    },
  };
  const remoteByOrder = new Map<
    string,
    {
      id: string;
      referenceId: string;
      amount: number;
      paymentMethod: string;
      status: string;
      currency: string;
      updatedAt: string;
      transactionId: string;
      paymentInstructions: object;
    }
  >();
  const jwt = new JwtService();
  const token = (sub = customer, role = 'CUSTOMER') => {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      {
        sub,
        sid: randomUUID(),
        jti: randomUUID(),
        iss: 'https://test.accounts.local',
        aud: 'test-api',
        iat: now,
        exp: now + 900,
        token_use: 'access',
        role,
        permissions: [],
        must_change_password: false,
      },
      {
        algorithm: 'RS256',
        privateKey: keys.privateKey
          .export({ type: 'pkcs8', format: 'pem' })
          .toString(),
      },
    );
  };
  let productId: string,
    addressId: string,
    cartId: string,
    voucherId: string,
    orderId: string;
  let providerStatus = 'PENDING';
  const transactionId = randomUUID();
  const key = randomUUID();
  let testIp = 1;
  beforeEach(() => {
    testIp++;
  });
  const auth = (r: any, sub = customer, role = 'CUSTOMER') =>
    r
      .set('X-Forwarded-For', '192.0.2.' + testIp)
      .set('Authorization', 'Bearer ' + token(sub, role));
  const payload = () => ({
    order: { addressId, voucherIds: [voucherId], userId: other },
    orderItems: [{ productId, quantity: 2 }],
    shipment: { courier: 'jne', service: 'REG', cost: 1 },
  });
  const checkout = (id = key, body = payload()) =>
    auth(request(app.getHttpServer()).post('/orders/checkout'))
      .set('Idempotency-Key', id)
      .send(body);
  beforeAll(async () => {
    for (const [name, protocol] of [
      ['DATABASE_URL', 'postgresql:'],
      ['REDIS_URL', 'redis:'],
    ] as const) {
      const u = new URL(process.env[name] ?? 'invalid');
      if (
        u.protocol !== protocol ||
        !['localhost', '127.0.0.1'].includes(u.hostname) ||
        (name === 'DATABASE_URL' && !u.pathname.endsWith('_test'))
      )
        throw new Error('E2E requires dedicated loopback test services');
    }
    Object.assign(process.env, {
      NODE_ENV: 'test',
      ACCOUNTS_JWT_PUBLIC_KEY: keys.publicKey
        .export({ type: 'spki', format: 'pem' })
        .toString(),
      ACCOUNTS_JWT_ISSUER: 'https://test.accounts.local',
      ACCOUNTS_JWT_AUDIENCE: 'test-api',
      ACCOUNTS_SERVICE_URL: 'http://127.0.0.1:9999',
      ROLE_STORE_ADMIN: 'STORE_ADMIN',
      ROLE_CUSTOMER: 'CUSTOMER',
      FRONTEND_ORIGINS: 'http://localhost:3001',
      SHIPPING_ORIGIN_ID: '123',
      RAJAONGKIR_BASE_URL: 'http://127.0.0.1:9997',
      RAJAONGKIR_API_KEY: 'fixture',
      PAYMENT_SERVICE_URL: 'http://127.0.0.1:9998',
      PAYMENT_INTERNAL_HMAC_SECRET: 'internal-secret',
      WEBHOOK_CALLBACK_SECRET: secret,
      CRON_SECRET: 'test-cron',
      LOG_LEVEL: 'silent',
    });
    jest.spyOn(axios, 'post').mockResolvedValue({data:{data:[{code:'jne',service:'REG',cost:10000,etd:'2-3'}]}});
    jest.spyOn(axios, 'request').mockImplementation(async (config: any) => {
      const url = new URL(config.url);
      if (url.pathname === '/payments' && config.method === 'POST') {
        const body = JSON.parse(config.data);
        expect(config.headers['X-Internal-Signature']).toMatch(
          /^[a-f0-9]{64}$/,
        );
        expect(config.headers['Idempotency-Key']).toBeDefined();
        const existing = remoteByOrder.get(body.referenceId);
        if (existing) return { status: 200, data: { data: existing } };
        const remote = {
          id: randomUUID(),
          referenceId: body.referenceId,
          amount: body.amount,
          paymentMethod: body.paymentMethod,
          currency: 'IDR',
          status: providerStatus,
          updatedAt: new Date().toISOString(),
          transactionId: randomUUID(),
          paymentInstructions: { qr: 'fixture' },
        };
        remoteByOrder.set(body.referenceId, remote);
        return { status: 200, data: { data: remote } };
      }
      if (url.pathname === '/payments' && config.method === 'GET')
        return {
          status: 200,
          data: {
            data: [...remoteByOrder.values()].filter(
              (p) => p.referenceId === url.searchParams.get('referenceId'),
            ),
          },
        };
      const id = url.pathname.split('/')[2];
      const remote = [...remoteByOrder.values()].find((p) => p.id === id);
      if (!remote) return { status: 404, data: {} };
      if (url.pathname.endsWith('/cancel')) remote.status = 'CANCELLED';
      remote.updatedAt = new Date().toISOString();
      return { status: 200, data: { data: remote } };
    });
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>({
      logger: false,
      rawBody: true,
    });
    configureApp(app);
    app.set('trust proxy', ['loopback']);
    await app.init();
    db = app.get(PrismaService);
    const category = await db.category.create({
      data: { name: 'Test category' },
    });
    const product = await db.product.create({
      data: {
        categoryId: category.id,
        name: 'Test product',
        price: 7500,
        weightGrams: 250,
        isActive: true,
        inventory: { create: { quantity: 5, isActive: true } },
      },
    });
    productId = product.id;
    const address = await db.address.create({
      data: {
        userId: customer,
        recipientName: 'Fixture',
        destinationId: 456,
        recipientPhoneNumber: '080000000',
        province: 'Test',
        city: 'Test',
        subdistrict: 'Test',
        village: 'Test',
        postalCode: '00000',
        address: 'Test',
      },
    });
    addressId = address.id;
    const cart = await db.cart.create({
      data: {
        userId: customer,
        cartItems: { create: { productId, quantity: 4 } },
      },
    });
    cartId = cart.id;
    const voucher = await db.voucher.create({
      data: {
        code: randomUUID(),
        name: 'Fixture',
        type: 'FIXED',
        group: 'CHECKOUT',
        value: 5000,
        minimumPurchase: 1000,
        isActive: true,
        startDate: new Date(Date.now() - 60000),
        endDate: new Date(Date.now() + 3600000),
        maxRedeemed: 2,
      },
    });
    voucherId = voucher.id;
    await db.userVoucher.create({
      data: {
        userId: customer,
        voucherId,
        claimedAt: new Date(),
        expiredAt: new Date(Date.now() + 3600000),
      },
    });
  }, 30000);
  afterAll(async () => {
    jest.restoreAllMocks();
    await app?.close();
  });
  it('publishes liveness, removes legacy auth, and enforces access roles', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).post('/auth/login').expect(404);
    await request(app.getHttpServer()).get('/orders/me').expect(401);
    await auth(
      request(app.getHttpServer()).get('/orders'),
      customer,
      'ACCOUNT_ADMIN',
    ).expect(403);
    await auth(
      request(app.getHttpServer()).get('/orders'),
      customer,
      'CUSTOMER',
    ).expect(403);
  });
  it('exposes generated OpenAPI with matching role and validation contracts', async () => {
    buildOpenApiDocument(app);
    const r = await request(app.getHttpServer())
      .get('/swagger/json')
      .expect(200);
    expect(r.body.paths['/orders/checkout'].post.security).toEqual([
      { accessToken: [] },
    ]);
    expect(r.body.paths['/orders/checkout'].post['x-required-roles']).toEqual([
      'CUSTOMER',
    ]);
    expect(r.body.paths['/orders/checkout'].post.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Idempotency-Key', required: true }),
      ]),
    );
    expect(r.body.paths['/payments/webhook'].post.security).toEqual([]);
    expect(r.body.components.schemas.CheckOutDto).toBeDefined();
    expect(
      Object.values(r.body.paths).reduce(
        (n: number, path: any) => n + Object.keys(path).length,
        0,
      ),
    ).toBe(92);
  });
  it('rejects invalid quantities and another account address', async () => {
    await checkout(randomUUID(), {
      ...payload(),
      orderItems: [{ productId, quantity: -1 }],
    }).expect(400);
    await auth(request(app.getHttpServer()).post('/orders/checkout'), other)
      .set('Idempotency-Key', randomUUID())
      .send(payload())
      .expect(404);
  });
  it('creates server-priced order, reserves stock, and replays idempotently', async () => {
    const r = await checkout().expect(201);
    orderId = r.body.data.orderId;
    expect(r.body.data.finalPrice).toBe(20000);
    expect((axios.post as jest.Mock).mock.calls.some(([,body])=>new URLSearchParams(body).get("weight")==="500")).toBe(true);
    const replay = await checkout().expect(201);
    expect(replay.body.data.orderId).toBe(orderId);
    await checkout(key, {
      ...payload(),
      orderItems: [{ productId, quantity: 1 }],
    }).expect(409);
    const stock = await db.inventory.findUniqueOrThrow({
      where: { productId },
    });
    expect(stock.reservedQuantity).toBe(2);
    expect(stock.quantity).toBe(5);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: orderId } })).userId,
    ).toBe(customer);
    expect(
      (
        await db.cartItem.findUniqueOrThrow({
          where: { cartId_productId: { cartId, productId } },
        })
      ).quantity,
    ).toBe(2);
  });
  it('rejects cross-account access and uses one upstream payment idempotency key', async () => {
    await auth(
      request(app.getHttpServer()).get('/orders/' + orderId),
      other,
    ).expect(404);
    await auth(
      request(app.getHttpServer()).post('/payments/' + orderId + '/start'),
      other,
    )
      .send(paymentInput)
      .expect(404);
    const r = await auth(
      request(app.getHttpServer()).post('/payments/' + orderId + '/start'),
    )
      .send(paymentInput)
      .expect(201);
    const again = await auth(
      request(app.getHttpServer()).post('/payments/' + orderId + '/start'),
    )
      .send(paymentInput)
      .expect(201);
    expect(again.body.data.id).toBe(r.body.data.id);
    expect(r.body.data.amount).toBe(20000);
    const calls = (axios.request as jest.Mock).mock.calls.filter(
      ([c]) => c.method === 'POST' && new URL(c.url).pathname === '/payments',
    );
    expect(calls).toHaveLength(2);
    expect(calls[0][0].headers['Idempotency-Key']).toBe(
      calls[1][0].headers['Idempotency-Key'],
    );
    await auth(
      request(app.getHttpServer()).post('/payments/' + orderId + '/start'),
    )
      .send({ ...paymentInput, paymentMethod: 'BCA_VA' })
      .expect(409);
  });
  const callback = (data: any, valid = true) => {
    const eventId = randomUUID(),
      ts = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      eventId,
      eventType: 'payment.status_changed',
      data,
    });
    const sig = createHmac('sha256', secret)
      .update(ts + '.' + eventId + '.')
      .update(body)
      .digest('hex');
    return request(app.getHttpServer())
      .post('/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Webhook-Timestamp', ts)
      .set('X-Webhook-Event-Id', eventId)
      .set('X-Webhook-Signature', valid ? sig : '0'.repeat(64))
      .send(body);
  };
  it('rejects invalid callbacks and amount mismatches; settles inventory exactly once', async () => {
    const remote = remoteByOrder.get(orderId)!;
    await callback(remote, false).expect(403);
    await callback({ ...remote, amount: 1 }).expect(409);
    await callback(remote).expect(200);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status,
    ).toBe('PENDING');
    remote.status = 'PAID';
    remote.updatedAt = new Date().toISOString();
    await callback(remote).expect(200);
    await callback(remote).expect(200);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status,
    ).toBe('PAID');
    const inventory = await db.inventory.findUniqueOrThrow({
      where: { productId },
    });
    expect(inventory.quantity).toBe(3);
    expect(inventory.reservedQuantity).toBe(0);
  });
  it('cancels an uninitialized payment and releases reserved inventory', async () => {
    const r = await checkout(randomUUID(), {
      ...payload(),
      order: { addressId },
      orderItems: [{ productId, quantity: 1 }],
    } as any).expect(201);
    const id = r.body.data.orderId;
    await auth(
      request(app.getHttpServer()).post('/payments/' + id + '/cancel'),
    ).expect(200);
    expect((await db.order.findUniqueOrThrow({ where: { id } })).status).toBe(
      'CANCELLED',
    );
    expect(
      (await db.inventory.findUniqueOrThrow({ where: { productId } }))
        .reservedQuantity,
    ).toBe(0);
  });

  async function fixture(stock = 5, quantity = 5) {
    const sub = randomUUID();
    const category = await db.category.create({
      data: { name: 'Fixture ' + sub },
    });
    const product = await db.product.create({
      data: {
        categoryId: category.id,
        name: 'Fixture',
        price: 10000,
        weightGrams: 250,
        isActive: true,
        inventory: { create: { quantity: stock, isActive: true } },
      },
    });
    const address = await db.address.create({
      data: {
        userId: sub,
        recipientName: 'Original',
        destinationId: 456,
        recipientPhoneNumber: '08123456789',
        province: 'Test',
        city: 'Test',
        subdistrict: 'Test',
        village: 'Test',
        postalCode: '00000',
        address: 'Original street',
        isPrimary: true,
      },
    });
    const cart = await db.cart.create({
      data: {
        userId: sub,
        cartItems: { create: { productId: product.id, quantity } },
      },
    });
    const send = (id = randomUUID(), q = 1) =>
      auth(request(app.getHttpServer()).post('/orders/checkout'), sub)
        .set('Idempotency-Key', id)
        .send({
          order: { addressId: address.id },
          orderItems: [{ productId: product.id, quantity: q }],
          shipment: { courier: 'jne', service: 'REG' },
        });
    return { sub, product, address, cart, send };
  }
  it('limits pending orders and expires abandoned checkout with exactly-once release', async () => {
    const f = await fixture();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++)
      ids.push((await f.send().expect(201)).body.data.orderId);
    await f.send().expect(409);
    const past = new Date(Date.now() - 1000);
    await db.payment.update({
      where: { orderId: ids[0] },
      data: { expiryDate: past, nextCheckAt: past },
    });
    const service = app.get(PaymentsService);
    await Promise.all([service.reconcileDue(), service.reconcileDue()]);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: ids[0] } })).status,
    ).toBe('CANCELLED');
    expect(
      (
        await db.inventory.findUniqueOrThrow({
          where: { productId: f.product.id },
        })
      ).reservedQuantity,
    ).toBe(2);
    await f.send().expect(201);
  });
  it('protects physical stock in concurrent checkouts', async () => {
    const f = await fixture(1, 2);
    const results = await Promise.all([f.send(), f.send()]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      (
        await db.inventory.findUniqueOrThrow({
          where: { productId: f.product.id },
        })
      ).reservedQuantity,
    ).toBe(1);
    expect(await db.order.count({ where: { userId: f.sub } })).toBe(1);
  });
  it('retains reserved stock after ambiguous upstream creation and permits same-key retry', async () => {
    const f = await fixture();
    const order = (await f.send().expect(201)).body.data.orderId;
    const mock = axios.request as jest.Mock;
    mock.mockRejectedValueOnce(new Error('provider timeout'));
    await auth(
      request(app.getHttpServer()).post('/payments/' + order + '/start'),
      f.sub,
    )
      .send(paymentInput)
      .expect(502);
    const pending = await db.payment.findUniqueOrThrow({
      where: { orderId: order },
    });
    expect(pending.initializationStartedAt).not.toBeNull();
    expect(pending.externalPaymentId).toBeNull();
    await app.get(PaymentsService).reconcileDue();
    expect(
      (
        await db.inventory.findUniqueOrThrow({
          where: { productId: f.product.id },
        })
      ).reservedQuantity,
    ).toBe(1);
    const retry = await auth(
      request(app.getHttpServer()).post('/payments/' + order + '/start'),
      f.sub,
    )
      .send(paymentInput)
      .expect(201);
    expect(retry.body.data.id).toBeDefined();
    await auth(
      request(app.getHttpServer()).post('/payments/' + order + '/cancel'),
      f.sub,
    ).expect(200);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order } })).status,
    ).toBe('CANCELLED');
    expect(
      (
        await db.inventory.findUniqueOrThrow({
          where: { productId: f.product.id },
        })
      ).reservedQuantity,
    ).toBe(0);
  });
  it('does not release stock when cancelling a payment whose creation is uncertain', async () => {
    const f = await fixture();
    const order = (await f.send().expect(201)).body.data.orderId;
    (axios.request as jest.Mock).mockRejectedValueOnce(
      new Error('provider timeout'),
    );
    await auth(
      request(app.getHttpServer()).post('/payments/' + order + '/start'),
      f.sub,
    )
      .send(paymentInput)
      .expect(502);
    const r = await auth(
      request(app.getHttpServer()).post('/payments/' + order + '/cancel'),
      f.sub,
    ).expect(200);
    expect(r.body.data.status).toBe('PENDING');
    expect(
      (
        await db.inventory.findUniqueOrThrow({
          where: { productId: f.product.id },
        })
      ).reservedQuantity,
    ).toBe(1);
  });
  it('preserves checkout address snapshot and enforces a single primary address', async () => {
    const f = await fixture();
    const order = (await f.send().expect(201)).body.data.orderId;
    await auth(
      request(app.getHttpServer()).patch('/addresses/' + f.address.id),
      f.sub,
    )
      .send({ address: 'Updated street' })
      .expect(200);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order } }))
        .addressSnapshot,
    ).toMatchObject({ address: 'Original street' });
    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...data
    } = f.address;
    const second = await db.address.create({
      data: { ...data, isPrimary: false },
    });
    await auth(
      request(app.getHttpServer()).patch('/addresses/' + second.id),
      f.sub,
    )
      .send({ isPrimary: true })
      .expect(200);
    expect(
      await db.address.count({ where: { userId: f.sub, isPrimary: true } }),
    ).toBe(1);
    expect(
      (await db.address.findUniqueOrThrow({ where: { id: second.id } }))
        .isPrimary,
    ).toBe(true);
    await auth(
      request(app.getHttpServer()).patch('/addresses/' + second.id),
      f.sub,
    )
      .send({ isPrimary: false })
      .expect(409);
  });
  it('enforces account-based limits and denies assignment without explicit permission', async () => {
    const sub = randomUUID();
    for (let i = 0; i < 20; i++)
      await auth(
        request(app.getHttpServer()).post(
          '/payments/' + randomUUID() + '/sync',
        ),
        sub,
      ).expect(404);
    await auth(
      request(app.getHttpServer()).post('/payments/' + randomUUID() + '/sync'),
      sub,
    ).expect(429);
    await auth(
      request(app.getHttpServer()).post('/payments/' + randomUUID() + '/sync'),
      randomUUID(),
    ).expect(404);
    await auth(
      request(app.getHttpServer()).post('/user-vouchers'),
      sub,
      'STORE_ADMIN',
    )
      .send({})
      .expect(403);
    await auth(
      request(app.getHttpServer()).post('/user-notifications'),
      sub,
      'STORE_ADMIN',
    )
      .send({})
      .expect(403);
    await auth(
      request(app.getHttpServer()).patch('/user-vouchers/' + randomUUID()),
      sub,
    ).expect(404);
  });
});
