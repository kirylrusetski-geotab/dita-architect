// ADR-013 amendment (2026-11-18) — Gate 3 for the new proxied path: both shells
// route `/heretto-search` to the search API with the same auth as `/heretto-api`.
// A wiring check over the two sources (the Swift shell has no unit harness).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..');
const swift = readFileSync(join(root, 'macos', 'Sources', 'DITAArchitect', 'DITASchemeHandler.swift'), 'utf-8');
const vite = readFileSync(join(root, 'vite.config.ts'), 'utf-8');

describe('the /heretto-search proxy exists in both run modes', () => {
  it('Swift: the path, the upstream, and the router sends it to the authenticated proxy', () => {
    expect(swift).toMatch(/static let searchProxyPath = "\/heretto-search"/);
    expect(swift).toMatch(/static let searchUpstreamPath = "\/ezdnxtgen\/api\/search"/);
    expect(swift).toMatch(/path\.hasPrefix\("\/heretto-api"\) \|\| path == Self\.searchProxyPath/);
    expect(swift).toMatch(/components\.path = Self\.upstreamPath\(for: path\)/);
    // the one auth injection covers both prefixes
    expect((swift.match(/forHTTPHeaderField: "Authorization"/g) ?? []).length).toBe(1);
  });

  it('Vite: a proxy entry that rewrites to the search API and injects the same Authorization', () => {
    const entry = vite.slice(vite.indexOf("'^/heretto-search$'"));
    expect(vite.indexOf("'^/heretto-search$'")).toBeGreaterThan(0);
    expect(entry).toMatch(/rewrite: \(p\) => p\.replace\(\/\^\\\/heretto-search\/, '\/ezdnxtgen\/api\/search'\)/);
    expect(entry.slice(0, 600)).toMatch(/proxyReq\.setHeader\('Authorization', herettoState\.auth\)/);
  });
});
