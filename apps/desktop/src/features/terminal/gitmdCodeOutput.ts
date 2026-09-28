const BRAND_TAIL_LENGTH = 12;
const ERROR_TAIL_LENGTH = 256;

export interface FilteredOutput {
  output: string;
  carry: string;
}

export function filterGitmdCodeOutput(
  carry: string,
  chunk: string,
  flush = false,
): FilteredOutput {
  const filtered = (carry + chunk)
    .replaceAll('Claude Code', 'GitMD Code')
    .replaceAll('Anthropic', 'GitMD AI')
    .replace(/\bclaude\b/gi, 'gitmd');
  const splitAt = flush ? filtered.length : Math.max(0, filtered.length - BRAND_TAIL_LENGTH);
  return { output: filtered.slice(0, splitAt), carry: filtered.slice(splitAt) };
}

export function updateRuntimeErrorHint(
  carry: string,
  chunk: string,
): { carry: string; hint: string | null; englishHint: string | null } {
  const next = (carry + chunk).slice(-ERROR_TAIL_LENGTH);
  if (/\b(401|unauthorized|invalid api key)\b/i.test(next)) {
    return { carry: next, hint: 'API Key 无效或没有访问权限', englishHint: 'The API key is invalid or access was denied' };
  }
  if (/\b(model).*(not found|invalid|does not exist|unsupported)\b/i.test(next)) {
    return { carry: next, hint: '模型不存在或接口不支持该模型', englishHint: 'The model does not exist or is unsupported by this endpoint' };
  }
  if (/ECONNREFUSED|ENOTFOUND|connection (failed|refused)|network error/i.test(next)) {
    return { carry: next, hint: '接口地址无法访问', englishHint: 'The endpoint could not be reached' };
  }
  return { carry: next, hint: null, englishHint: null };
}
