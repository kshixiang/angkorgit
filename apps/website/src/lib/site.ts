const FALLBACK_VERSION = '0.15.0';

async function latestReleaseVersion(): Promise<string> {
  try {
    const res = await fetch('https://api.github.com/repos/cheat2001/gitmd/releases/latest', {
      headers: { accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return FALLBACK_VERSION;
    const data = (await res.json()) as { tag_name?: string };
    const tag = typeof data.tag_name === 'string' ? data.tag_name : '';
    return /^v\d+\.\d+\.\d+$/.test(tag) ? tag.slice(1) : FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}

export const SITE = {
  name: 'GitMD',
  alternateNames: ['GitMD', 'gitmd'],
  title:
    'GitMD — fast, free Git client and Git GUI for macOS, Windows & Linux',
  description:
    'GitMD is a fast, free, open-source Git client and Git GUI for macOS, Windows, and Linux, built native with Tauri v2, Rust and libgit2. Visual commit graphs, side-by-side diff review, visual conflict resolution, and AI assistance.',
  repo: 'https://github.com/cheat2001/gitmd',
  releases: 'https://github.com/cheat2001/gitmd/releases',
  license: 'https://github.com/cheat2001/gitmd/blob/main/LICENSE',
  docs: 'https://github.com/cheat2001/gitmd/tree/main/docs',
  contributing: 'https://github.com/cheat2001/gitmd/blob/main/docs/Contributing.md',
  codeOfConduct: 'https://github.com/cheat2001/gitmd/blob/main/CODE_OF_CONDUCT.md',
  security: 'https://github.com/cheat2001/gitmd/blob/main/SECURITY.md',
  ci: 'https://github.com/cheat2001/gitmd/actions/workflows/ci.yml',
  buyMeACoffee: 'https://buymeacoffee.com/chansocheatsok',
  tagline: 'Everyday Git, made delightful.',
  latestVersion: await latestReleaseVersion(),
  latestUrl: 'https://github.com/cheat2001/gitmd/releases',
  assetUrl: (version: string, asset: string) =>
    `https://github.com/cheat2001/gitmd/releases/download/v${version}/${asset}`,
};

export const NAV = [
  { href: '/#conflicts', label: 'What it does' },
  { href: '/#box', label: 'In the box' },
  { href: '/#install', label: 'Install' },
  { href: '/docs/', label: 'Docs' },
] as const;
