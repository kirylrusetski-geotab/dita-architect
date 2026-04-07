// Comprehensive syllable counting algorithm provided by user.

const exceptions: { [key: string]: number } = {
    abalone: 4, abare: 3, abbruzzese: 4, abed: 2, aborigine: 5, abruzzese: 4, acreage: 3, adame: 3, adieu: 2,
    adobe: 3, anemone: 4, anyone: 3, apache: 3, aphrodite: 4, apostrophe: 4, ariadne: 4, cafe: 2, calliope: 4,
    catastrophe: 4, chile: 2, chloe: 2, circe: 2, coyote: 3, daphne: 2, epitome: 4, eurydice: 4, euterpe: 3,
    every: 2, everywhere: 3, forever: 3, gethsemane: 4, guacamole: 4, hermione: 4, hyperbole: 4, jesse: 2,
    jukebox: 2, karate: 3, machete: 3, maybe: 2, naive: 2, newlywed: 3, penelope: 4, people: 2, persephone: 4,
    phoebe: 2, pulse: 1, queue: 1, recipe: 3, riverbed: 3, sesame: 3, shoreline: 2, simile: 3,
    snuffleupagus: 5, sometimes: 2, syncope: 3, tamale: 3, waterbed: 3, wednesday: 2, yosemite: 4, zoe: 2,
};
const problematics = new RegExp(["awe($|d|so)", "cia(?:l|$)", "tia", "cius", "cious", "[^aeiou]giu", "[aeiouy][^aeiouy]ion", "iou", "sia$", "eous$", "[oa]gue$", ".[^aeiuoycgltdb]{2,}ed$", ".ely$", "^jua", "uai", "eau", "^busi$", "(?:[aeiouy](?:[bcfgklmnprsvwxyz]|ch|dg|g[hn]|lch|l[lv]|mm|nch|n[cgn]|r[bcnsv]|squ|s[chkls]|th)ed$)", "(?:[aeiouy](?:[bdfklmnprstvy]|ch|g[hn]|lch|l[lv]|mm|nch|nn|r[nsv]|squ|s[cklst]|th)es$)"].join("|"), "g");
const silentE = new RegExp("[aeiouy](?:[bcdfgklmnprstvyz]|ch|dg|g[hn]|l[lv]|mm|n[cgns]|r[cnsv]|squ|s[cklst]|th)e$", "g");
const additions = new RegExp("(?:" + ["([^aeiouy])\\1l", "[^aeiouy]ie(?:r|s?t)", "[aeiouym]bl", "eo", "ism", "asm", "thm", "dnt", "snt", "uity", "dea", "gean", "oa", "ua", "react?", "orbed", "shred", "eings?", "[aeiouy]sh?e[rs]"].join("|") + ")$", "g");
const doubles = new RegExp(["creat(?!u)", "[^gq]ua[^auieo]", "[aeiou]{3}", "^(?:ia|mc|coa[dglx].)", "^re(app|es|im|us)", "(th|d)eist"].join("|"), "g");
const triples = new RegExp(["[^aeiou]y[ae]", "[^l]lien", "riet", "dien", "iu", "io", "ii", "uen", "[aeilotu]real", "real[aeilotu]", "iell", "eo[^aeiou]", "[aeiou]y[aeiou]"].join("|"), "g");
const specialIa = /[^s]ia/;
const prefixesSuffixes = new RegExp(["^(?:" + ["un", "fore", "ware", "none?", "out", "post", "sub", "pre", "pro", "dis", "side", "some"].join("|") + ")", "(?:" + ["ly", "less", "some", "ful", "ers?", "ness", "cians?", "ments?", "ettes?", "villes?", "ships?", "sides?", "ports?", "shires?", "[gnst]ion(?:ed|s)?"].join("|") + ")$"].join("|"), "g");
const compounds = new RegExp(["^(?:" + ["above", "anti", "ante", "counter", "hyper", "afore", "agri", "infra", "intra", "inter", "over", "semi", "ultra", "under", "extra", "dia", "micro", "mega", "kilo", "pico", "nano", "macro", "somer"].join("|") + ")", "(?:" + ["fully", "berry", "woman", "women", "edly", "union", "((?:[bcdfghjklmnpqrstvwxz])|[aeiou])ye?ing"].join("|") + ")$"].join("|"), "g");
const ons = /(creations?|ology|ologist|onomy|onomist)$/g;

const countSyllables = (word: string): number => {
    const original = word.toLowerCase().replace(/['’]/g, '').replace(/[^a-z]/g, '');
    if (original.length === 0)
        return 0;
    if (original.length < 3)
        return 1;
    if (exceptions[original])
        return exceptions[original];
    
    let count = 0;
    let value = original;
    
    const replacerAndCounter = (amount: number) => (_: string): string => { count += amount; return ''; };
    const counterOnly = (amount: number) => (match: string): string => { count += amount; return match; };
    
    value = value.replace(ons, replacerAndCounter(3));
    value = value.replace(compounds, replacerAndCounter(2));
    value = value.replace(prefixesSuffixes, replacerAndCounter(1));
    
    const vowelGroups = value.match(/[aeiouy]+/g);
    if (vowelGroups) {
        count += vowelGroups.length;
    }
    
    value.replace(problematics, counterOnly(-1));
    value.replace(silentE, counterOnly(-1));
    value.replace(additions, counterOnly(1));
    value.replace(doubles, counterOnly(1));
    value.replace(triples, counterOnly(1));
    
    if (specialIa.test(value)) {
        count++;
    }
    
    return Math.max(1, count);
};


export const calculateFleschReadingEase = (text: string): { score: number; label: string; color: string } => {
  if (!text.trim()) {
    return { score: 0, label: 'N/A', color: 'bg-slate-100 text-slate-500' };
  }

  // 1. COUNT SENTENCES: Use logic tuned for technical docs (newlines are sentences).
  const sentences = text.split(/[\n.?!]+/).filter(s => s.trim().length > 2);
  const sentenceCount = sentences.length || 1;
  
  // 2. COUNT WORDS: Use logic tuned for technical docs (handles dashes, etc.).
  const words = text
    .replace(/’/g, "'") // Normalize apostrophes
    .replace(/[–—]/g, ' ') // Treat en/em dashes as spaces
    .replace(/^\s*\d+\.\s*/gm, '') // Remove list numbers
    .match(/[a-zA-Z'-]+/g) || [];
  
  const wordCount = words.length || 1;
  
  // 3. COUNT SYLLABLES: Use the new, comprehensive algorithm.
  // FIX: The errors suggest `syllableCount` was not a number, likely because the `reduce` function
  // was missing its initial value of `0`. The provided code has this, but to be robust,
  // we ensure the result of `countSyllables` is always treated as a number.
  const syllableCount = words.reduce((total, word) => total + (Number(countSyllables(word)) || 0), 0);
  
  if (wordCount < 5 || syllableCount === 0) {
      return { score: 0, label: 'N/A', color: 'bg-slate-100 text-slate-500' };
  }

  // Formula: 206.835 - 1.015(total words / total sentences) - 84.6(total syllables / total words)
  const score = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount);
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  // Determine Label and Color
  let label = '';
  let color = '';

  if (finalScore >= 90) {
    label = 'Very Easy';
    color = 'bg-green-100 text-green-700';
  } else if (finalScore >= 80) {
    label = 'Easy';
    color = 'bg-green-50 text-green-600';
  } else if (finalScore >= 70) {
    label = 'Fairly Easy';
    color = 'bg-blue-50 text-blue-600';
  } else if (finalScore >= 60) {
    label = 'Standard';
    color = 'bg-blue-100 text-blue-700';
  } else if (finalScore >= 50) {
    label = 'Fairly Difficult';
    color = 'bg-yellow-50 text-yellow-700';
  } else if (finalScore >= 30) {
    label = 'Difficult';
    color = 'bg-orange-50 text-orange-700';
  } else {
    label = 'Very Difficult';
    color = 'bg-red-50 text-red-700';
  }

  return { score: finalScore, label, color };
};
