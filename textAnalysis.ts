const exceptions: Record<string, number> = Object.create(null);
Object.assign(exceptions, { abalone: 4, abare: 3, abbruzzese: 4, abed: 2, aborigine: 5, abruzzese: 4,
acreage: 3, adame: 3, adieu: 2, adobe: 3, anemone: 4, anyone: 3, apache: 3, aphrodite: 4,
apostrophe: 4, ariadne: 4, cafe: 2, calliope: 4, catastrophe: 4, chile: 2, chloe: 2, circe: 2, coyote:
3, daphne: 2, epitome: 4, eurydice: 4, euterpe: 3, every: 2, everywhere: 3, forever: 3,
gethsemane: 4, guacamole: 4, hermione: 4, hyperbole: 4, jesse: 2, jukebox: 2, karate: 3,
machete: 3, maybe: 2, naive: 2, newlywed: 3, penelope: 4, people: 2, persephone: 4, phoebe: 2,
pulse: 1, queue: 1, recipe: 3, riverbed: 3, sesame: 3, shoreline: 2, simile: 3, snuffleupagus: 5,
sometimes: 2, syncope: 3, tamale: 3, waterbed: 3, wednesday: 2, yosemite: 4, zoe: 2 }); 

const problematics = new RegExp(["awe($|d|so)", "cia(?:l|$)", "tia", "cius", "cious", "[^aeiou]giu", "[aeiouy][^aeiouy]ion", "iou", "sia$", "eous$", "[oa]gue$", ".[^aeiuoycgltdb]{2,}ed$", ".ely$", "^jua", "uai", "eau", "^busi$", "(?:[aeiouy](?:[bcfgklmnprsvwxyz]|ch|dg|g[hn]|lch|l[lv]|mm|nch|n[cgn]|r[bcnsv]|squ|s[chkls]|th)ed$)", "(?:[aeiouy](?:[bdfklmnprstvy]|ch|g[hn]|lch|l[lv]|mm|nch|nn|r[nsv]|squ|s[cklst]|th)es$)"].join("|"), "g"); 

const silentE = new RegExp("[aeiouy](?:[bcdfgklmnprstvyz]|ch|dg|g[hn]|l[lv]|mm|n[cgns]|r[cnsv]|squ|s[cklst]|th)e$", "g"); 

const additions = new RegExp("(?:" + ["([^aeiouy])\\1l", "[^aeiouy]ie(?:r|s?t)", "[aeiouym]bl", "eo", "ism", "asm", "thm", "dnt", "snt", "uity", "dea", "gean", "oa", "ua", "react?", "orbed", "shred", "eings?", "[aeiouy]sh?e[rs]"].join("|") + ")$", "g"); 

const doubles = new RegExp(["creat(?!u)", "[^gq]ua[^auieo]", "[aeiou]{3}", "^(?:ia|mc|coa[dglx].)", "^re(app|es|im|us)", "(th|d)eist"].join("|"), "g"); 

const triples = new RegExp(["[^aeiou]y[ae]", "[^l]lien", "riet", "dien", "iu", "io", "ii", "uen", "[aeilotu]real", "real[aeilotu]", "iell", "eo[^aeiou]", "[aeiou]y[aeiou]"].join("|"), "g"); 

const specialIa = /[^s]ia/; 

const prefixesSuffixes = new RegExp(["^(?:" + ["un", "fore", "ware", "none?", "out", "post", "sub", "pre", "pro", "dis", "side", "some"].join("|") + ")", "(?:" + ["ly", "less", "some", "ful", "ers?", "ness", "cians?", "ments?", "ettes?", "villes?", "ships?", "sides?", "ports?", "shires?", "[gnst]ion(?:ed|s)?"].join("|") + ")$"].join("|"), "g"); 

const compounds = new RegExp(["^(?:" + ["above", "anti", "ante", "counter", "hyper", "afore", "agri", "infra", "intra", "inter", "over", "semi", "ultra", "under", "extra", "dia", "micro", "mega", "kilo", "pico", "nano", "macro", "somer"].join("|") + ")", "(?:" + ["fully", "berry", "woman", "women", "edly", "union", "((?:[bcdfghjklmnpqrstvwxz])|[aeiou])ye?ing"].join("|") + ")$"].join("|"), "g"); 

const ons = /(creations?|ology|ologist|onomy|onomist)$/g; 

const countSyllables = (word: string) => { 
  const original = word.toLowerCase().replace(/['’]/g, '').replace(/[^a-z]/g, ''); 
  if (original.length === 0) return 0; 
  if (original.length < 3) return 1; 
  if (exceptions[original]) return exceptions[original]; 
  
  let count = 0; 
  let value = original; 
  
  const replacerAndCounter = (amount: number) => (_: string) => { count += amount; return ''; };

  value = value.replace(ons, replacerAndCounter(3));
  value = value.replace(compounds, replacerAndCounter(2));
  value = value.replace(prefixesSuffixes, replacerAndCounter(1));

  const vowelGroups = value.match(/[aeiouy]+/g);
  if (vowelGroups) { count += vowelGroups.length; }

  // These patterns adjust the count without modifying the string.
  // We use match() to count occurrences explicitly.
  count -= (value.match(problematics) || []).length;
  count -= (value.match(silentE) || []).length;
  count += (value.match(additions) || []).length;
  count += (value.match(doubles) || []).length;
  count += (value.match(triples) || []).length; 
  
  if (specialIa.test(value)) { count++; } 
  
  return Math.max(1, count); 
}; 

const countWords = (text: string) => {
  return text.trim().match(/\S+/g)?.length || 0;
}; 

const countSentences = (text: string) => 
  text.trim() ? (text.match(/[^.!?]+[.!?]+/g) || []).length || 1 : 0; 

export const analyzeText = (text: string) => { 
  const characterCount = text.length; 
  const wordCount = countWords(text); 
  const sentenceCount = countSentences(text); 
  const words = text.trim().match(/\S+/g) || []; 
  
  let syllableCount = 0; 
  for (const word of words) { 
    syllableCount += countSyllables(word); 
  } 
  
  if (wordCount === 0 || sentenceCount === 0) { 
    return { score: '-', readingLevel: '-', gradeLevel: '-', note: '-', characterCount, wordCount, sentenceCount, syllableCount }; 
  } 
  
  const avgWordsPerSentence = wordCount / sentenceCount; 
  const avgSyllablesPerWord = syllableCount / wordCount; 
  const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord; 
  
  let note = ''; 
  let readingLevel = ''; 
  
  if (score >= 90) { note = 'Very easy to read'; readingLevel = '5th grade'; } 
  else if (score >= 80) { note = 'Easy to read'; readingLevel = '6th grade'; } 
  else if (score >= 70) { note = 'Fairly easy to read'; readingLevel = '7th grade'; } 
  else if (score >= 60) { note = 'Plain English'; readingLevel = '8th & 9th grade'; } 
  else if (score >= 50) { note = 'Fairly difficult to read'; readingLevel = '10th to 12th grade'; } 
  else if (score >= 30) { note = 'Difficult to read'; readingLevel = 'College'; } 
  else { note = 'Very difficult to read'; readingLevel = 'College graduate'; } 
  
  const gradeLevel = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59; 
  
  return { 
    score: parseFloat(score.toFixed(1)), 
    readingLevel, 
    gradeLevel: parseFloat(gradeLevel.toFixed(1)), 
    note, 
    characterCount, 
    wordCount, 
    sentenceCount, 
    syllableCount 
  }; 
};
