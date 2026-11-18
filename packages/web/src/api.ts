import type { AppConfig, AuthorInfo, Commit, HeatmapRow, Repo, ScanResult } from '@one-on-one/shared'

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError('Server not reachable on :4317 — run pnpm dev', 0)
  }
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 300)
    } catch {}
    // Vite proxy returns 5xx/502 with empty body when backend is down
    if (res.status >= 500 && !detail) throw new ApiError('Server not reachable on :4317 — run pnpm dev', res.status)
    throw new ApiError(`${init?.method ?? 'GET'} /api${path} failed: ${res.status} ${res.statusText} ${detail}`.trim(), res.status)
  }
  return (await res.json()) as T
}

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export interface RangeQuery {
  from: string
  to: string
  repos?: string[]
}

const rangeQs = ({ from, to, repos }: RangeQuery) =>
  qs({ from, to, repos: repos?.length ? repos.join(',') : undefined })

export const getHealth = () => request<{ ok: true }>('/health')
export const getConfig = () => request<AppConfig>('/config')
export const putConfig = (config: AppConfig) =>
  request<AppConfig>('/config', { method: 'PUT', body: JSON.stringify(config) })
export const getRepos = () => request<Repo[]>('/repos')
export const getAuthors = (repoId?: string) => request<AuthorInfo[]>(`/authors${qs({ repoId })}`)
export const scan = () => request<ScanResult>('/scan', { method: 'POST' })
/** no query = all commits */
export const getCommits = (q?: Partial<RangeQuery>) => request<Commit[]>(`/commits${q ? rangeQs(q as RangeQuery) : ''}`)
export const getHeatmap = (q: RangeQuery) => request<HeatmapRow[]>(`/heatmap${rangeQs(q)}`)
