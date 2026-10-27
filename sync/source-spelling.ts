// Source-spelling pass (ADR-012, BUG-31).
//
// serializeLexicalToXml writes the whole patched clone with one XMLSerializer
// pass, and XMLSerializer has its own spelling: <x></x> comes back as <x/>,
// &#160; as the literal character, single-quoted attributes as double-quoted.
// The DOM kept the meaning but not the bytes, so every save re-spelled markup
// no edit touched.
//
// This pass puts the source's spelling back wherever the markup is unchanged.
// Both strings are split into markup tokens, each token is reduced to what it
// means (its canonical form), the two canonical streams are aligned, and a run
// of output tokens that aligns to whole source tokens is written as that exact
// source substring. Anything emitted from the source is canonically equal to
// what it replaces, so the pass changes spelling, never content. When either
// side cannot be tokenized, the output is returned unchanged.

interface Token {
  start: number;
  end: number;
  /** The token's meaning. A self-closed `<x/>` has two entries, like `<x></x>`. */
  canon: string[];
}

// One alternation, tried at each position (sticky). Order matters: the
// specific `<!`/`<?` forms before tags, tags before text.
const TOKEN = new RegExp(
  [
    '<!--[\\s\\S]*?-->',
    '<!\\[CDATA\\[[\\s\\S]*?\\]\\]>',
    '<\\?[\\s\\S]*?\\?>',
    '<!DOCTYPE(?:[^[>]|\\[[^\\]]*\\])*>',
    '<\\/([^\\s>]+)\\s*>',
    '<([^\\s/>!?]+)((?:\\s+[^\\s=/>]+\\s*=\\s*(?:"[^"]*"|\'[^\']*\'))*)\\s*(\\/?)>',
    '[^<]+',
  ].join('|'),
  'y',
);
const ATTR = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const REF = /&(#x[0-9a-fA-F]+|#[0-9]+|lt|gt|amp|quot|apos);/g;
const NAMED: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };

/** XML line-end normalization: CRLF and a lone CR read as LF. */
const foldLineEnds = (s: string): string => s.replace(/\r\n?/g, '\n');

/** Decode the five XML entities and numeric references; null when anything
 *  else follows an `&` (an entity the DTD defines), so the token never
 *  matches — its meaning cannot be known here. */
const decode = (s: string): string | null => {
  if (s.replace(REF, '').includes('&')) return null;
  let bad = false;
  const out = s.replace(REF, (_, ref: string) => {
    if (ref[0] !== '#') return NAMED[ref];
    const cp = ref[1] === 'x' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
    try { return String.fromCodePoint(cp); } catch { bad = true; return ''; }
  });
  return bad ? null : out;
};

let unmatchable = 0;
/** A canonical entry equal to nothing else, ever. */
const never = (): string => `\u0000never\u0000${unmatchable++}`;

const tokenize = (xml: string): Token[] | null => {
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < xml.length) {
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(xml);
    if (!m || m[0].length === 0) return null;
    const raw = m[0];
    const end = pos + raw.length;
    let canon: string[];
    if (m[1] !== undefined) {
      canon = [`E\u0001${m[1]}`];
    } else if (m[2] !== undefined) {
      const attrs: string[] = [];
      let ok = true;
      for (const a of m[3].matchAll(ATTR)) {
        // Attribute-value normalization: each literal whitespace character
        // reads as a space; references are decoded after that.
        const value = decode(foldLineEnds(a[2] ?? a[3]).replace(/[\t\n]/g, ' '));
        if (value === null) { ok = false; break; }
        attrs.push(`${a[1]}=${value}`);
      }
      // In source order: XMLSerializer keeps attribute order, so an order
      // change is a real change to the output and keeps its spelling.
      const open = ok ? `S\u0001${m[2]}\u0001${attrs.join('\u0002')}` : never();
      canon = m[4] ? [open, `E\u0001${m[2]}`] : [open];
    } else if (raw[0] === '<') {
      canon = [`X\u0001${foldLineEnds(raw)}`];
    } else {
      const text = decode(foldLineEnds(raw));
      canon = [text === null ? never() : `T\u0001${text}`];
    }
    tokens.push({ start: pos, end, canon });
    pos = end;
  }
  return tokens;
};

/** Past this many differences in the changed middle, the middle keeps the
 *  serializer's spelling (the prefix and suffix are still restored). */
const MAX_DIFF = 2000;

/**
 * Myers' O(ND) diff: index pairs [ai, bi] of equal entries in a longest
 * common subsequence of a and b, or null when the edit distance exceeds maxD.
 */
const myers = (a: string[], b: string[], maxD: number): Array<[number, number]> | null => {
  const n = a.length, m = b.length;
  const limit = Math.min(n + m, maxD);
  const off = limit + 1;
  const v = new Int32Array(2 * limit + 3);
  const trace: Int32Array[] = [];
  for (let d = 0; d <= limit; d++) {
    // Step d reads only diagonals -d-1 … d+1; keep just that window.
    trace.push(v.slice(off - d - 1, off + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[off + k] = x;
      if (x >= n && y >= m) {
        // Walk back through the saved states, collecting the diagonal moves.
        const pairs: Array<[number, number]> = [];
        let cx = n, cy = m;
        for (let dd = d; dd > 0; dd--) {
          const w = trace[dd];
          const at = (k: number) => w[k + dd + 1]; // the window starts at diagonal -dd-1
          const ck = cx - cy;
          const pk = ck === -dd || (ck !== dd && at(ck - 1) < at(ck + 1)) ? ck + 1 : ck - 1;
          const px = at(pk);
          const py = px - pk;
          while (cx > px && cy > py) { pairs.push([cx - 1, cy - 1]); cx--; cy--; }
          cx = px; cy = py;
        }
        while (cx > 0 && cy > 0) { pairs.push([cx - 1, cy - 1]); cx--; cy--; }
        return pairs.reverse();
      }
    }
  }
  return null;
};

let sourceMemo: { source: string; tokens: Token[] | null } | null = null;
const sourceTokens = (source: string): Token[] | null => {
  if (sourceMemo?.source !== source) sourceMemo = { source, tokens: tokenize(source) };
  return sourceMemo.tokens;
};

let observer: ((before: string, after: string) => void) | null = null;
/** Test seam (ADR-012 B2): see the output before and after every pass. */
export const setSourceSpellingObserver = (fn: ((before: string, after: string) => void) | null): void => {
  observer = fn;
};

export const restoreSourceSpelling = (output: string, source: string): string => {
  const srcToks = sourceTokens(source);
  const outToks = tokenize(output);
  if (!srcToks || !outToks) return output;

  // Flatten to canonical streams, remembering which token each entry is in.
  const flatten = (toks: Token[]) => {
    const canon: string[] = [];
    const tokOf: number[] = [];
    toks.forEach((t, ti) => { for (const c of t.canon) { canon.push(c); tokOf.push(ti); } });
    return { canon, tokOf };
  };
  const S = flatten(srcToks);
  const O = flatten(outToks);

  // Align: common prefix and suffix, then Myers on the middle.
  const srcOf = new Int32Array(O.canon.length).fill(-1);
  let p = 0;
  while (p < S.canon.length && p < O.canon.length && S.canon[p] === O.canon[p]) { srcOf[p] = p; p++; }
  let se = S.canon.length, oe = O.canon.length;
  while (se > p && oe > p && S.canon[se - 1] === O.canon[oe - 1]) { se--; oe--; srcOf[oe] = se; }
  if (p < se && p < oe) {
    const pairs = myers(S.canon.slice(p, se), O.canon.slice(p, oe), MAX_DIFF);
    // The equality check keeps the pass safe even against a diff bug: a pair
    // is used only when its two canonical entries really are equal.
    if (pairs) for (const [si, oi] of pairs) if (S.canon[p + si] === O.canon[p + oi]) srcOf[p + oi] = p + si;
  }

  const firstCanonOfSrcTok = (ci: number) => ci === 0 || S.tokOf[ci - 1] !== S.tokOf[ci];
  const lastCanonOfSrcTok = (ci: number) => ci === S.canon.length - 1 || S.tokOf[ci + 1] !== S.tokOf[ci];

  // Emit. A run of output tokens whose canonical entries align to consecutive
  // source entries that begin and end on source-token boundaries is written as
  // that source substring; every other output token is written as is.
  let result = '';
  let lastFromSource = -1; // index of the last source token emitted, if the output ended on one
  const outCanonStart: number[] = [];
  { let c = 0; for (const t of outToks) { outCanonStart.push(c); c += t.canon.length; } }
  let i = 0;
  while (i < outToks.length) {
    const c0 = outCanonStart[i];
    const s0 = srcOf[c0];
    let good = -1, goodSrcEnd = -1;
    if (s0 >= 0 && firstCanonOfSrcTok(s0)) {
      let expect = s0;
      for (let j = i; j < outToks.length; j++) {
        let ok = true;
        for (let c = outCanonStart[j]; c < outCanonStart[j] + outToks[j].canon.length; c++) {
          if (srcOf[c] !== expect) { ok = false; break; }
          expect++;
        }
        if (!ok) break;
        if (lastCanonOfSrcTok(expect - 1)) { good = j; goodSrcEnd = expect - 1; }
      }
    }
    if (good >= 0) {
      const fromTok = S.tokOf[s0];
      const toTok = S.tokOf[goodSrcEnd];
      result += source.slice(srcToks[fromTok].start, srcToks[toTok].end);
      lastFromSource = good === outToks.length - 1 ? toTok : -1;
      i = good + 1;
    } else {
      result += output.slice(outToks[i].start, outToks[i].end);
      lastFromSource = -1;
      i++;
    }
  }

  // The DOM keeps no text after the root element: when the output ends on the
  // source's last markup token, restore the whitespace that followed it.
  const tail = srcToks[srcToks.length - 1];
  if (
    lastFromSource >= 0 && lastFromSource === srcToks.length - 2 &&
    /^\s+$/.test(source.slice(tail.start, tail.end))
  ) {
    result += source.slice(tail.start, tail.end);
  }

  observer?.(output, result);
  return result;
};
