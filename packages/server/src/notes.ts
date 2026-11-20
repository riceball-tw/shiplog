import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Notes } from '@shiplog/shared'
import { homeDir } from './config.js'

export const MAX_THEMES = 50
const MAX_NAME = 200
const MAX_OUTCOME = 2000
const MAX_ITEMS = 10000
const MAX_KEY = 300

export function notesPath(): string {
  return path.join(homeDir(), 'notes.json')
}

export const emptyNotes = (): Notes => ({ themes: [], highlights: [] })

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

/** Keep only known fields; tolerate a hand-edited or partial file. */
export function normalizeNotes(raw: Partial<Notes> | null | undefined): Notes {
  const themes = Array.isArray(raw?.themes) ? raw.themes : []
  return {
    themes: themes.map((t) => ({
      id: String(t.id),
      name: String(t.name ?? ''),
      outcome: String(t.outcome ?? ''),
      tickets: strs(t.tickets),
      commits: strs(t.commits),
      repoIds: strs(t.repoIds),
    })),
    highlights: strs(raw?.highlights),
  }
}

export async function loadNotes(): Promise<Notes> {
  try {
    return normalizeNotes(JSON.parse(await fs.readFile(notesPath(), 'utf8')))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return emptyNotes()
    throw err
  }
}

/** Atomic write: tmp file in the same dir, then rename. */
export async function saveNotes(notes: Notes): Promise<Notes> {
  const normalized = normalizeNotes(notes)
  await fs.mkdir(homeDir(), { recursive: true })
  const tmp = `${notesPath()}.${process.pid}.tmp`
  await fs.writeFile(tmp, JSON.stringify(normalized, null, 2) + '\n')
  await fs.rename(tmp, notesPath())
  return normalized
}

/** Returns human-readable problems; empty array means the notes are valid. */
export function validateNotes(raw: unknown): string[] {
  const errs: string[] = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['body must be a JSON object']
  const n = raw as Record<string, unknown>
  const keyList = (label: string, v: unknown): void => {
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) return void errs.push(`${label} must be an array of strings`)
    if (v.length > MAX_ITEMS) errs.push(`${label} has more than ${MAX_ITEMS} entries`)
    if (v.some((x: string) => x.length > MAX_KEY)) errs.push(`${label} entries must be at most ${MAX_KEY} characters`)
  }
  keyList('highlights', n.highlights)
  if (!Array.isArray(n.themes)) {
    errs.push('themes must be an array')
    return errs
  }
  if (n.themes.length > MAX_THEMES) errs.push(`themes: at most ${MAX_THEMES} allowed`)
  const ids = new Set<string>()
  n.themes.slice(0, MAX_THEMES + 1).forEach((t: unknown, i: number) => {
    const at = `themes[${i}]`
    if (!t || typeof t !== 'object' || Array.isArray(t)) return void errs.push(`${at} must be an object`)
    const o = t as Record<string, unknown>
    if (typeof o.id !== 'string' || !o.id || o.id.length > 100) errs.push(`${at}.id must be a non-empty string up to 100 characters`)
    else if (ids.has(o.id)) errs.push(`${at}.id "${o.id}" is duplicated`)
    else ids.add(o.id)
    if (typeof o.name !== 'string' || o.name.length > MAX_NAME) errs.push(`${at}.name must be a string up to ${MAX_NAME} characters`)
    if (typeof o.outcome !== 'string' || o.outcome.length > MAX_OUTCOME) errs.push(`${at}.outcome must be a string up to ${MAX_OUTCOME} characters`)
    for (const k of ['tickets', 'commits', 'repoIds'] as const) keyList(`${at}.${k}`, o[k])
  })
  return errs
}
