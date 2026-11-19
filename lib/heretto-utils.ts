import type { HerettoItem } from '../types/heretto';

/**
 * Returns true if a DOMParser result document contains a parse error.
 * DOMParser never throws — it embeds a <parsererror> element instead.
 */
function hasParseError(doc: Document): boolean {
  return doc.querySelector('parsererror') !== null;
}

export const parseHerettoFolder = (xml: string): HerettoItem[] => {
  if (!xml || !xml.trim()) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  if (hasParseError(doc)) return [];

  const items: HerettoItem[] = [];

  const children = doc.querySelector('children');
  if (!children) return items;

  for (const child of Array.from(children.children)) {
    const tag = child.tagName.toLowerCase();
    const id = child.getAttribute('id') || '';
    const name = child.getAttribute('name') || id;

    if (tag === 'folder') {
      items.push({ uuid: id, name, type: 'folder' });
    } else if (tag === 'resource') {
      items.push({ uuid: id, name, type: 'file' });
    }
  }

  // Sort: folders first, then alphabetical within each group
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return items;
};

/**
 * v1.2.0: a map is not a topic. The topic editor opens a ditamap as a blank page
 * (maps are read-only, FR-079), so every way of opening a Heretto file sends a
 * map to the Map view instead. Decided by name, as Heretto lists files.
 */
export const isDitamapName = (name: string): boolean => /\.(ditamap|bookmap)$/i.test(name.trim());

export const getFolderName = (xml: string): string => {
  if (!xml || !xml.trim()) return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');

  if (hasParseError(doc)) return '';

  const nameEl = doc.querySelector('name');
  return nameEl?.textContent?.trim() || '';
};
