import { describe, expect, it } from 'vitest';
import { remoteWebUrl } from '@angkorgit/core';

describe('remoteWebUrl', () => {
  it('turns an https remote into the repository page', () => {
    expect(remoteWebUrl('https://github.com/cheat2001/angkorgit.git')).toBe('https://github.com/cheat2001/angkorgit');
  });

  it('turns an scp-style ssh remote into an https page', () => {
    expect(remoteWebUrl('git@gitlab.com:group/subgroup/api.git')).toBe('https://gitlab.com/group/subgroup/api');
  });

  it('drops the ssh port and user from an ssh:// remote', () => {
    expect(remoteWebUrl('ssh://git@git.example.com:2222/team/tool.git')).toBe('https://git.example.com/team/tool');
  });

  it('keeps http and a non-standard web port', () => {
    expect(remoteWebUrl('http://gitea.local:3000/me/notes.git')).toBe('http://gitea.local:3000/me/notes');
  });

  it('maps a Bitbucket Server scm path to its browse page', () => {
    expect(remoteWebUrl('https://bitbucket.example.com/scm/proj/service.git')).toBe(
      'https://bitbucket.example.com/projects/PROJ/repos/service/browse',
    );
  });

  it('leaves Bitbucket Cloud paths alone', () => {
    expect(remoteWebUrl('git@bitbucket.org:team/service.git')).toBe('https://bitbucket.org/team/service');
  });

  it('strips a trailing slash before the .git suffix check', () => {
    expect(remoteWebUrl('https://github.com/cheat2001/angkorgit.git/')).toBe('https://github.com/cheat2001/angkorgit');
  });

  it('returns null for a local path remote', () => {
    expect(remoteWebUrl('/Users/demo/repos/upstream')).toBeNull();
    expect(remoteWebUrl('../sibling.git')).toBeNull();
  });
});
