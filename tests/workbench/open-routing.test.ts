// v1.2.0 smoke finding (Kiryl, 2026-11-19): opening Altitude_User_Guide.ditamap
// from the Explorer loaded it into the topic editor as a blank page. A map is
// not a topic (maps are read-only, FR-079), so every way of opening a Heretto
// file goes through one function that sends a map to the Map view.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { isDitamapName } from '../../lib/heretto-utils';

describe('isDitamapName', () => {
  it.each([
    ['Altitude_User_Guide.ditamap', true], ['Guide.DITAMAP', true], ['book.bookmap', true], [' spaced.ditamap ', true],
    ['topic.dita', false], ['notes.xml', false], ['ditamap.dita', false], ['site.sitemap', false],
  ])('%s → %s', (name, expected) => {
    expect(isDitamapName(name)).toBe(expected);
  });
});

describe('the one door for Heretto opens', () => {
  const app = readFileSync(join(__dirname, '..', '..', 'dita-architect.tsx'), 'utf-8');

  it('handleHerettoOpen is called in exactly one place, inside openHerettoItem, after the map check', () => {
    const calls = [...app.matchAll(/handleHerettoOpen\(/g)].map(m => m.index!);
    expect(calls.length).toBe(1);
    const door = app.indexOf('const openHerettoItem = useCallback(');
    const doorEnd = app.indexOf('}, [', door);
    expect(calls[0]).toBeGreaterThan(door);
    expect(calls[0]).toBeLessThan(doorEnd);
    expect(app.slice(door, calls[0])).toMatch(/isDitamapName\(item\.name\)[\s\S]*showView\('map'\)/);
  });

  it('the Explorer, Search and Map views all open through it', () => {
    expect(app).toMatch(/onOpenTopic=\{openHerettoItem\}/);                  // Explorer (tree + filename results)
    expect(app).toMatch(/openableItem\(file, herettoRootUuid, fallbackPath\)\.then\(openHerettoItem\)/); // Search hits, map topicrefs
    expect(app).toMatch(/onOpenHit=\{openSearchHit\}/);
    expect(app).toMatch(/onOpenTopic=\{file => openHerettoFile\(file\)\}/);
  });
});
