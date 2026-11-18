import type { AppConfig, Commit, Repo, ScanResult } from '@one-on-one/shared'
import { discoverRepos } from './discovery.js'
import { readCommits } from './gitlog.js'
import type { CommitStore } from './store.js'

const CONCURRENCY = 4

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export async function scan(
  config: AppConfig,
  store: CommitStore,
): Promise<ScanResult & { repoList: Repo[] }> {
  const start = Date.now()
  const repoList = await discoverRepos(config)
  const included = repoList.filter((r) => r.included)
  const errors: ScanResult['errors'] = []

  const results = await mapLimit(included, CONCURRENCY, async (repo): Promise<Commit[]> => {
    try {
      return await readCommits(repo.path, config.since, {
        repoId: repo.id,
        authorEmails: config.authorEmails,
        excludeFromStats: config.excludeFromStats,
        keywords: config.classifier.keywords,
      })
    } catch (err) {
      errors.push({ repoPath: repo.path, message: err instanceof Error ? err.message : String(err) })
      return []
    }
  })

  // upsert in repo order so duplicate clones resolve deterministically (first wins)
  const newCommits = results.reduce((n, commits) => n + store.upsert(commits), 0)
  return { repos: included.length, newCommits, durationMs: Date.now() - start, errors, repoList }
}
