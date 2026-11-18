import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageOn, annualAccrual, contributionSplit, pensionableSalary, projectPension } from '../src/domain/pension.ts';

test('pensionable salary subtracts the franchise', () => {
  assert.equal(pensionableSalary(52_000, 1), 34_455);
});

test('pensionable salary applies the part-time factor', () => {
  assert.equal(pensionableSalary(46_000, 0.6), 17_073);
});

test('pensionable salary is capped at the salary cap', () => {
  assert.equal(pensionableSalary(150_000, 1), 120_255);
});

test('pensionable salary is never negative (salary below franchise)', () => {
  assert.equal(pensionableSalary(16_000, 0.9), 0);
});

test('pensionable salary rejects invalid part-time factors', () => {
  assert.throws(() => pensionableSalary(40_000, 0), RangeError);
  assert.throws(() => pensionableSalary(40_000, 1.2), RangeError);
});

test('annual accrual is 1.75% of pensionable salary', () => {
  assert.equal(annualAccrual(34_455), 602.96);
});

test('contribution split is 60% employer / 40% employee', () => {
  assert.deepEqual(contributionSplit(10_000), { total: 2_700, employer: 1_620, employee: 1_080 });
});

test('age is calculated in whole years', () => {
  assert.equal(ageOn('1972-04-15', '2026-11-18'), 54);
  assert.equal(ageOn('1979-12-20', '2026-11-18'), 46);
});

test('projection at the standard retirement age (68) adds future accrual with no reduction', () => {
  const result = projectPension({
    birthDate: '1972-04-15', fullTimeSalary: 52_000, partTimeFactor: 1, accruedToDate: 5_000, asOf: '2026-11-18',
  });
  assert.equal(result.yearsToRetirement, 14);
  assert.equal(result.futureAccrual, 8_441.44);
  assert.equal(result.unreducedAnnualPension, 13_441.44);
  assert.equal(result.earlyRetirementReduction, 0);
  assert.equal(result.projectedAnnualPension, 13_441.44);
  assert.equal(result.retirementDate, '2040-04-15');
});

test('projection at age 63 (early retirement) applies R5 reduction', () => {
  // M-1004: birthDate 1966-06-30, fullTimeSalary 98000, partTimeFactor 0.8, as of 2026-11-18
  // Current age: 60, years to 63: 3
  // Historical accrued (2016-2025 at 92000, 0.8 pt): 10 × ((92000-17545)×0.8) × 0.0175 = 10,423.70
  // Future accrual for 3 years at current salary: 3 × ((98000-17545)×0.8) × 0.0175 = 3,379.11
  // Unreduced total: 10,423.70 + 3,379.11 = 13,802.81
  // Expected reduction: (68 - 63) * 0.065 = 5 * 0.065 = 0.325
  // Projected: 13,802.81 × (1 - 0.325) = 9,316.90
  const result = projectPension({
    birthDate: '1966-06-30', fullTimeSalary: 98_000, partTimeFactor: 0.8, accruedToDate: 10_423.70, asOf: '2026-11-18', retirementAge: 63,
  });
  assert.equal(result.retirementAge, 63);
  assert.equal(result.yearsToRetirement, 3);
  assert.equal(result.earlyRetirementReduction, 0.325);
  assert.equal(result.unreducedAnnualPension, 13_802.81);
  assert.equal(result.projectedAnnualPension, 9_316.90);
});

test('projection rejects retirement age below 60', () => {
  assert.throws(() => projectPension({
    birthDate: '1972-04-15', fullTimeSalary: 52_000, partTimeFactor: 1, accruedToDate: 0, asOf: '2026-11-18', retirementAge: 59,
  }), /must be between 60 and 68/);
});

test('projection rejects retirement age above 68', () => {
  assert.throws(() => projectPension({
    birthDate: '1972-04-15', fullTimeSalary: 52_000, partTimeFactor: 1, accruedToDate: 0, asOf: '2026-11-18', retirementAge: 69,
  }), /must be between 60 and 68/);
});

test('projection rejects retirement age below current age', () => {
  // M-1006: birthDate 1959-11-05, current age is 67 on 2026-11-18
  assert.throws(() => projectPension({
    birthDate: '1959-11-05', fullTimeSalary: 39_000, partTimeFactor: 1, accruedToDate: 10_000, asOf: '2026-11-18', retirementAge: 66,
  }), /cannot be below the member's current age/);
});

test('projection accepts retirement age equal to current age (literal R5)', () => {
  // M-1006: birthDate 1959-11-05, current age is 67 on 2026-11-18
  const result = projectPension({
    birthDate: '1959-11-05', fullTimeSalary: 39_000, partTimeFactor: 1, accruedToDate: 10_000, asOf: '2026-11-18', retirementAge: 67,
  });
  assert.equal(result.retirementAge, 67);
  assert.equal(result.yearsToRetirement, 0);
});

