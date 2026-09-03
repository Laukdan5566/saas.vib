const assert = require('node:assert/strict');
const { billingAmounts } = require('../dist/src/billing-amounts');
const invoice = { value: 200, dueDate: new Date('2026-08-28T00:00:00Z'), status: 'pending' };
assert.deepEqual(billingAmounts(invoice, new Date('2026-09-03T15:00:00Z')), {
  daysLate: 6, principalValue: 200, fineValue: 4, interestValue: 0.4, payableValue: 204.4
});
assert.equal(billingAmounts(invoice, new Date('2026-08-29T02:59:59Z')).payableValue, 200);
assert.equal(billingAmounts(invoice, new Date('2026-08-29T03:00:00Z')).daysLate, 1);
assert.equal(billingAmounts(invoice, new Date('2026-09-27T15:00:00Z')).payableValue, 206);
assert.equal(billingAmounts({ ...invoice, status: 'paid' }).payableValue, 200);
assert.equal(billingAmounts({ ...invoice, status: 'canceled' }).fineValue, 0);
assert.equal(billingAmounts({ ...invoice, status: 'expired' }, new Date('2026-09-03T15:00:00Z')).payableValue, 204.4);
console.log('Billing amount tests passed');

const { BillingService } = require('../dist/src/billing.service');
async function testRenewal() {
  let stored = { ...invoice, id: 'test', companyId: 'company', txId: 'same-txid', detail: 'Test', providerPayload: {}, paidAt: null };
  const calls = [];
  const prisma = { billingInvoice: {
    findFirst: async () => stored,
    update: async ({ data }) => (stored = { ...stored, ...data })
  } };
  const service = new BillingService(prisma);
  service.efiConfig = async () => ({ pixBaseUrl: 'https://example.test', pixKey: 'test' });
  service.efiToken = async () => 'test';
  service.refreshCompanySubscriptionStatus = async () => {};
  service.requestJson = async (url, options, body) => {
    calls.push(options.method);
    if (options.method === 'GET') return { status: 'ATIVA', calendario: { criacao: '2026-08-01T12:00:00Z', expiracao: 86400 } };
    assert.equal(options.method, 'PATCH');
    assert.ok(url.endsWith('/same-txid'));
    return { txid: 'same-txid', status: 'ATIVA', calendario: { criacao: '2026-08-01T12:00:00Z', expiracao: body.calendario.expiracao }, valor: body.valor };
  };
  const user = { role: 'super_admin' };
  const updated = await service.generatePix('test', user);
  assert.deepEqual(calls, ['GET', 'PATCH']);
  assert.equal(updated.value, 200);
  assert.equal(updated.dueDate, invoice.dueDate);
  assert.equal(updated.status, 'overdue');
  service.requestJson = async () => ({ status: 'CONCLUIDA' });
  assert.equal((await service.generatePix('test', user)).status, 'paid');
  await assert.rejects(service.generatePix('test', user));
  console.log('Pix renewal and paid protection tests passed');
}
testRenewal().catch(error => { console.error(error); process.exit(1); });
