import type { Classification, CommitType } from '@shiplog/shared'

const COMMIT_TYPES: readonly CommitType[] = [
  'feat', 'fix', 'refactor', 'perf', 'test', 'docs', 'ci', 'build', 'chore', 'style', 'revert', 'other',
]

const CC_RE = /^(\w+)(\(([^)]*)\))?(!)?:\s/
// Subjects git writes itself; branch names inside them would otherwise trip the keyword rules.
const GIT_REVERT_RE = /^(Revert|Reapply) "/
const GIT_MERGE_RE = /^Merge (branch|remote-tracking branch|pull request|tag) /

const KEYWORDS: [CommitType, RegExp][] = [
  ['fix', /\b(fix(es|ed)?|bug|hotfix|patch|resolve[sd]?)\b/i],
  ['feat', /\b(add(s|ed)?|implement(s|ed)?|support(s|ed)?|introduce[sd]?|new)\b/i],
  ['refactor', /\b(refactor(s|ed)?|clean ?up|rename[sd]?|restructure[sd]?|simplif(y|ies|ied))\b/i],
  ['perf', /\b(perf|optimi[sz]e[sd]?|speed(s|ed)? up)\b/i],
  ['test', /\btests?\b/i],
  ['docs', /\b(docs?|readme)\b/i],
  ['revert', /\brevert(s|ed)?\b/i],
  ['build', /\b(bump(s|ed)?|upgrade[sd]?|deps)\b/i],
]

const TEST_RE = /(\.(test|spec)\.[^/]+$)|(^|\/)(__tests__|tests?)\//
const DOCS_RE = /(\.md$)|(^|\/)docs\//i
const CI_RE = /(^|\/)(\.github\/|\.gitlab-ci\.yml$|Jenkinsfile$)/

function fileType(files: string[]): CommitType | null {
  if (files.length === 0) return null
  if (files.every((f) => TEST_RE.test(f))) return 'test'
  if (files.every((f) => DOCS_RE.test(f))) return 'docs'
  if (files.every((f) => CI_RE.test(f))) return 'ci'
  return null
}

function safeRegex(source: string): RegExp | null {
  try {
    return new RegExp(source, 'i')
  } catch {
    return null
  }
}

export function classify(
  subject: string,
  files: string[] = [],
  extraKeywords: Partial<Record<CommitType, string[]>> = {},
  body = '',
): Classification {
  const cc = CC_RE.exec(subject)
  if (cc && COMMIT_TYPES.includes(cc[1]!.toLowerCase() as CommitType)) {
    return {
      type: cc[1]!.toLowerCase() as CommitType,
      scope: cc[3]?.trim() || null,
      breaking: !!cc[4] || /^BREAKING[ -]CHANGE/m.test(body),
      confidence: 'high',
    }
  }
  const low = (type: CommitType): Classification => ({
    type,
    scope: null,
    breaking: /^BREAKING[ -]CHANGE/m.test(body),
    confidence: 'low',
  })

  if (GIT_REVERT_RE.test(subject)) return { ...low('revert'), confidence: 'high' }
  if (GIT_MERGE_RE.test(subject)) return low('other')

  for (const [type, sources] of Object.entries(extraKeywords) as [CommitType, string[]][]) {
    for (const src of sources ?? []) {
      if (safeRegex(src)?.test(subject)) return low(type)
    }
  }
  for (const [type, re] of KEYWORDS) {
    if (re.test(subject)) return low(type)
  }
  return low(fileType(files) ?? 'other')
}

/** Ticket keys (ABC-123) and MR/PR refs (!12, #12) from a commit message, deduped. */
export function parseRefs(text: string): { tickets: string[]; mergeRequests: string[] } {
  const tickets = text.match(/\b[A-Z][A-Z0-9]+-\d+\b/g) ?? []
  const mrs = [...text.matchAll(/(?<![\w&])([!#]\d+)\b/g)].map((m) => m[1]!)
  return { tickets: [...new Set(tickets)], mergeRequests: [...new Set(mrs)] }
}
