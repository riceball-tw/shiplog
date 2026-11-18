import type { CommitType } from '@one-on-one/shared'

/** Single source of truth for commit type colors (reused by the timeline). */
export const COMMIT_TYPE_COLORS: Record<CommitType, { hex: string; badge: string }> = {
  feat: { hex: '#10b981', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' },
  fix: { hex: '#ef4444', badge: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
  refactor: { hex: '#8b5cf6', badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300' },
  perf: { hex: '#f59e0b', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' },
  test: { hex: '#06b6d4', badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300' },
  docs: { hex: '#3b82f6', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  ci: { hex: '#6366f1', badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300' },
  build: { hex: '#ec4899', badge: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300' },
  chore: { hex: '#64748b', badge: 'bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300' },
  style: { hex: '#14b8a6', badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300' },
  revert: { hex: '#f97316', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' },
  other: { hex: '#94a3b8', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
}
