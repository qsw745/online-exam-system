import assert from 'node:assert/strict'
import test from 'node:test'
import { masteryFromRecentPractice } from './mastery.js'

test('无记录或仅一两次答对不会提前标记部分掌握', () => {
  for (const flags of [[], [true], [true, true]]) assert.equal(masteryFromRecentPractice(flags), 'not_mastered')
})
test('连续三次答对为部分掌握，连续五次为已掌握', () => {
  assert.equal(masteryFromRecentPractice([true, true, true]), 'partially_mastered')
  assert.equal(masteryFromRecentPractice([true, true, true, false, true]), 'partially_mastered')
  assert.equal(masteryFromRecentPractice([true, true, true, true, true]), 'mastered')
})
test('最近答错打断掌握状态，只考虑最近五次', () => {
  assert.equal(masteryFromRecentPractice([false, true, true, true, true]), 'not_mastered')
  assert.equal(masteryFromRecentPractice([true, true, true, true, true, false]), 'mastered')
})
