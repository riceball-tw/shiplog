/** The synthetic history. Tests import the same table, so expected counts never drift from the repos. */
export const ME = 'e2e@example.com'
export const OTHER = 'someone@else.example'

export interface FixtureCommit {
  repo: string
  /** days before now (local noon) */
  daysAgo: number
  subject: string
  author?: string
}

export const COMMITS: FixtureCommit[] = [
  { repo: 'payments-api', daysAgo: 20, subject: 'feat(payments): add refund endpoint PAY-101' },
  { repo: 'payments-api', daysAgo: 18, subject: 'fix(payments): handle null currency PAY-101' },
  { repo: 'payments-api', daysAgo: 15, subject: 'refactor(ledger): split ledger writer PAY-102' },
  { repo: 'payments-api', daysAgo: 12, subject: 'feat: add idempotency keys PAY-102' },
  { repo: 'payments-api', daysAgo: 10, subject: 'feat: add webhook signing PAY-999', author: OTHER },
  { repo: 'payments-api', daysAgo: 9, subject: 'chore: bump dependencies' },
  { repo: 'payments-api', daysAgo: 3, subject: 'fix: retry on gateway timeout' },
  { repo: 'checkout-web', daysAgo: 17, subject: 'feat(cart): add promo code input CHK-7' },
  { repo: 'checkout-web', daysAgo: 11, subject: 'fix(cart): promo rounding CHK-7' },
  { repo: 'checkout-web', daysAgo: 7, subject: 'ci: cache pnpm store' },
  { repo: 'checkout-web', daysAgo: 6, subject: 'fix: unrelated typo in footer', author: OTHER },
  { repo: 'checkout-web', daysAgo: 5, subject: 'style: format cart module' },
  { repo: 'infra-scripts', daysAgo: 14, subject: 'chore: rotate log files' },
  { repo: 'infra-scripts', daysAgo: 4, subject: 'feat: add deploy script' },
]

export const REPOS = [...new Set(COMMITS.map((c) => c.repo))]
const mine = COMMITS.filter((c) => (c.author ?? ME) === ME)
const NOISE = /^(chore|ci|style|build)[:(]/
export const COUNTS = {
  total: mine.length,
  noise: mine.filter((c) => NOISE.test(c.subject)).length,
  kept: mine.filter((c) => !NOISE.test(c.subject)).length,
  repos: new Set(mine.map((c) => c.repo)).size,
  /** Unassigned rows: 3 tickets + "No ticket" per repo (payments-api, infra-scripts); noise adds checkout-web's */
  keptGroups: 5,
  allGroups: 6,
}
export const TICKETS = ['PAY-101', 'PAY-102', 'CHK-7']
