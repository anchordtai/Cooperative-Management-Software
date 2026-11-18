const assert = require('node:assert/strict');
const { test } = require('node:test');
const { fixedLoanSchedule, money, positiveAmount, toMinorUnits } = require('../dist/services/finance');

test('currency operations convert exactly between decimal strings and kobo', () => {
  assert.equal(positiveAmount('123.45'), 12345);
  assert.equal(positiveAmount(0.01), 1);
  assert.equal(toMinorUnits('0.00'), 0);
  assert.equal(money(9999999999), '99999999.99');
  for (const value of ['0', '-1', '1.001', '1e2', '1.00oops', {}, null]) {
    assert.throws(() => positiveAmount(value));
  }
});

test('flat-rate schedules reconcile and anchor month-end dates', () => {
  const schedule = fixedLoanSchedule(10001, 1200, 3, new Date('2028-01-31T15:00:00Z'));
  assert.deepEqual(schedule.map(row => row.dueOn), ['2028-02-29', '2028-03-31', '2028-04-30']);
  assert.equal(schedule.reduce((sum, row) => sum + row.principal, 0), 10001);
  assert.equal(schedule.reduce((sum, row) => sum + row.interest, 0), 300);
  assert.throws(() => fixedLoanSchedule(1, 0, 2, new Date()), /too small/);
});
