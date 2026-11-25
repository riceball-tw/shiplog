import { describe, expect, it } from 'vitest'
import { resolvePref } from './prefs'

describe('resolvePref', () => {
  it('keeps allowed values and falls back otherwise', () => {
    expect(resolvePref('type', ['ticket', 'type', 'repo'], 'ticket')).toBe('type')
    expect(resolvePref(null, ['ticket', 'type', 'repo'], 'ticket')).toBe('ticket')
  })
  it('groupBy: the removed theme option falls back to ticket', () => {
    expect(resolvePref('theme', ['ticket', 'type', 'repo'], 'ticket')).toBe('ticket')
  })
  it('tab: legacy summary maps to story', () => {
    const tabs = ['story', 'breakdown', 'commits'] as const
    expect(resolvePref('summary', tabs, 'story', { summary: 'story' })).toBe('story')
    expect(resolvePref('commits', tabs, 'story', { summary: 'story' })).toBe('commits')
    expect(resolvePref('toString', tabs, 'story', { summary: 'story' })).toBe('story')
  })
})
