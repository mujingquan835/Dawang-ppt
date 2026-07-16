#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

function resolveExistingPath(candidate) {
  if (!candidate) return '';
  const resolved = path.resolve(candidate);
  return existsSync(resolved) ? resolved : '';
}

function lookupCommand(command) {
  const binary = process.platform === 'win32' ? 'where' : 'which';
  try {
    const output = execFileSync(binary, [command], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return output
      .split(/\r?\n/)
      .map(line => line.trim())
      .find(line => line && existsSync(line)) || '';
  } catch {
    return '';
  }
}

function platformCandidates() {
  if (process.platform === 'win32') {
    return [
      process.env.OPENSSL_PATH,
      process.env.OPENSSL_BINARY,
      process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Git', 'mingw64', 'bin', 'openssl.exe'),
      process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Git', 'usr', 'bin', 'openssl.exe'),
      process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Git', 'bin', 'openssl.exe'),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'mingw64', 'bin', 'openssl.exe'),
    ].filter(Boolean);
  }

  if (process.platform === 'darwin') {
    return [
      process.env.OPENSSL_PATH,
      process.env.OPENSSL_BINARY,
      '/opt/homebrew/bin/openssl',
      '/usr/local/bin/openssl',
      '/usr/bin/openssl',
    ].filter(Boolean);
  }

  return [
    process.env.OPENSSL_PATH,
    process.env.OPENSSL_BINARY,
    '/usr/bin/openssl',
    '/usr/local/bin/openssl',
  ].filter(Boolean);
}

export function resolveOpenSslExecutablePath() {
  for (const candidate of platformCandidates()) {
    const resolved = resolveExistingPath(candidate);
    if (resolved) return resolved;
  }

  return lookupCommand(process.platform === 'win32' ? 'openssl.exe' : 'openssl');
}

export function getOpenSslExecutablePath() {
  const resolved = resolveOpenSslExecutablePath();
  if (resolved) return resolved;
  throw new Error(
    'OpenSSL executable not found. Set OPENSSL_PATH to a local openssl executable and rerun the preview command.',
  );
}
