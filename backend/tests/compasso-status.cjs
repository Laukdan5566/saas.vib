const assert = require('node:assert/strict');
const { mapCompassoAccess, isCompassoStatus } = require('../dist/src/compasso-status');
for (const status of ['paid', 'open', 'overdue', 'in_grace']) assert.equal(mapCompassoAccess(status).accessBlocked, false);
assert.deepEqual(mapCompassoAccess('blocked'), { status: 'past_due', accessBlocked: true });
assert.equal(isCompassoStatus('blocked'), true);
assert.equal(isCompassoStatus('suspended'), false);
console.log('Compasso status tests passed');
