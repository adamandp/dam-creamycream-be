import { createHash, createHmac, randomUUID } from 'node:crypto';
import {
  classifyStatus,
  internalSignature,
  notificationSchema,
  verifiedSignature,
} from './payments.service';
import { UpdateDiscountDto } from '../discounts/dto/update-discount.dto';
import { UpdateVoucherDto } from '../vouchers/dto/update-voucher.dto';
import { CheckOutDto } from '../orders/dto/checkout.dto';
describe('Payment and checkout trust boundary', () => {
  const key = 'callback-secret';
  const eventId = randomUUID();
  const ts = Math.floor(Date.now() / 1000).toString();
  const raw = Buffer.from(
    JSON.stringify({
      eventId,
      eventType: 'payment.status_changed',
      data: { amount: 10000 },
    }),
  );
  const sig = createHmac('sha256', key)
    .update(ts + '.' + eventId + '.')
    .update(raw)
    .digest('hex');
  it('validates raw callback bytes, timestamp, event ID and HMAC', () => {
    expect(verifiedSignature(raw, ts, eventId, sig, key)).toBe(true);
    expect(
      verifiedSignature(Buffer.from('tampered'), ts, eventId, sig, key),
    ).toBe(false);
    expect(verifiedSignature(raw, ts, eventId, sig, 'wrong')).toBe(false);
    expect(verifiedSignature(raw, '0', eventId, sig, key)).toBe(false);
    expect(
      notificationSchema.safeParse(JSON.parse(raw.toString())).success,
    ).toBe(true);
  });
  it('never treats uncertain transactions as paid or cancelled', () => {
    for (const status of [
      'CREATING',
      'UNKNOWN',
      'REVIEW_REQUIRED',
      'CHALLENGE',
      'AUTHORIZED',
      'PENDING',
    ])
      expect(classifyStatus(status)).toBe('PENDING');
    expect(classifyStatus('PAID')).toBe('PAID');
    expect(classifyStatus('EXPIRED')).toBe('CANCELLED');
  });
  it('signs internal requests with exact route, token, key and body', () => {
    const body = '{"amount":10000}';
    const hash = (value: string) =>
      createHash('sha256').update(value).digest('hex');
    const expected = createHmac('sha256', key)
      .update(
        ['v1', ts, 'POST', '/payments', hash('jwt'), 'key', hash(body)].join(
          '\n',
        ),
      )
      .digest('hex');
    expect(internalSignature(key, ts, '/payments', 'jwt', 'key', body)).toBe(
      expected,
    );
    expect(
      internalSignature(key, ts, '/payments', 'jwt', 'key', '{}'),
    ).not.toBe(expected);
  });
  const productId = randomUUID();
  const input = {
    order: { addressId: randomUUID(), userId: randomUUID() },
    orderItems: [{ productId, quantity: 1 }],
    shipment: { courier: 'jne', service: 'REG', cost: 1 },
  };
  it('strips client identity and rejects non-integer or duplicate quantities', () => {
    expect(CheckOutDto.schema.parse(input).order).not.toHaveProperty('userId');
    for (const quantity of [-1, 0, 0.5, 101])
      expect(
        CheckOutDto.schema.safeParse({
          ...input,
          orderItems: [{ productId, quantity }],
        }).success,
      ).toBe(false);
    expect(
      CheckOutDto.schema.safeParse({
        ...input,
        orderItems: [...input.orderItems, ...input.orderItems],
      }).success,
    ).toBe(false);
  });
  it('never accepts client-owned promotion redemption counters', () => {
    expect(
      UpdateDiscountDto.schema.parse({ redeemedCount: 999 }),
    ).not.toHaveProperty('redeemedCount');
    expect(
      UpdateVoucherDto.schema.parse({ redeemedCount: 999 }),
    ).not.toHaveProperty('redeemedCount');
  });
});
