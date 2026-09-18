import type { RemoteInfo } from '../git/types';

export interface ParsedRemote {
  scheme: string;
  host: string;
  path: string;
}

export function parseRemote(url: string): ParsedRemote | null {
  const trimmed = url.trim().replace(/\/$/, '').replace(/\.git$/, '');
  const web = trimmed.match(/^(https?):\/\/(?:[^@/]+@)?([^/]+)\/(.+)$/);
  if (web) return { scheme: web[1], host: web[2], path: web[3] };
  const ssh = trimmed.match(/^ssh:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/);
  if (ssh) return { scheme: 'https', host: ssh[1], path: ssh[2] };
  const scp = trimmed.match(/^(?:[^@/]+@)([^:/]+):(.+)$/);
  if (scp) return { scheme: 'https', host: scp[1], path: scp[2] };
  return null;
}

export function pickForgeRemote(
  remotes: RemoteInfo[],
  headUpstream: string | null,
): RemoteInfo | null {
  if (remotes.length === 0) return null;
  const upstreamRemote = headUpstream?.split('/')[0];
  if (upstreamRemote) {
    const match = remotes.find((remote) => remote.name === upstreamRemote);
    if (match) return match;
  }
  return remotes.find((remote) => remote.name === 'origin') ?? remotes[0];
}

export type ForgeKind = 'github' | 'gitlab' | 'bitbucket' | 'bitbucket-server';

export interface ForgeRemote {
  kind: ForgeKind;
  scheme: string;
  host: string;
  owner: string;
  repo: string;
  webUrl: string;
}

export function parseForgeRemote(url: string): ForgeRemote | null {
  const remote = parseRemote(url);
  if (!remote) return null;
  const hostname = remote.host.split(':')[0];
  const segments = remote.path.split('/').filter(Boolean);
  const webUrl = `${remote.scheme}://${remote.host}/${remote.path}`;
  const base = { scheme: remote.scheme, host: remote.host, webUrl };

  if (hostname.includes('github')) {
    if (segments.length !== 2) return null;
    return { kind: 'github', owner: segments[0], repo: segments[1], ...base };
  }
  if (hostname === 'bitbucket.org') {
    if (segments.length !== 2) return null;
    return { kind: 'bitbucket', owner: segments[0], repo: segments[1], ...base };
  }
  if (hostname.includes('bitbucket')) {
    if (segments[0] !== 'scm' || segments.length < 3) return null;
    return {
      kind: 'bitbucket-server',
      owner: segments[1],
      repo: segments.slice(2).join('/'),
      ...base,
    };
  }
  if (hostname.includes('gitlab')) {
    if (segments.length < 2) return null;
    return {
      kind: 'gitlab',
      owner: segments.slice(0, -1).join('/'),
      repo: segments[segments.length - 1],
      ...base,
    };
  }
  return null;
}

export interface ForgeTarget {
  name: string;
  remote: ForgeRemote;
}

export function forgeTargets(remotes: RemoteInfo[], source: ForgeRemote): ForgeTarget[] {
  const seen = new Set<string>();
  const out: ForgeTarget[] = [];
  for (const entry of remotes) {
    const remote = parseForgeRemote(entry.url);
    if (!remote || remote.kind !== source.kind) continue;
    if (remote.host.toLowerCase() !== source.host.toLowerCase()) continue;
    const key = `${remote.owner}/${remote.repo}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: entry.name, remote });
  }
  return out;
}

export function defaultForgeTarget(targets: ForgeTarget[], sourceName: string): string {
  const upstream = targets.find((t) => t.name === 'upstream');
  if (upstream && upstream.name !== sourceName) return upstream.name;
  return targets.find((t) => t.name === sourceName)?.name ?? targets[0]?.name ?? sourceName;
}

export function sameForgeRepo(a: ForgeRemote, b: ForgeRemote): boolean {
  return (
    a.host.toLowerCase() === b.host.toLowerCase() &&
    a.owner.toLowerCase() === b.owner.toLowerCase() &&
    a.repo.toLowerCase() === b.repo.toLowerCase()
  );
}
