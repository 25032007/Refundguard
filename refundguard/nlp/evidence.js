/**
 * Evidence extraction from complaint narratives.
 *
 * Evidence comes purely from the complaint text: categories trigger on
 * vocabulary (keywords present as tokens, phrases present as contiguous word
 * sequences in the normalized text). Nothing about a customer's suspicious or
 * normal status is ever consulted.
 */

const config = require('./config');
const { normalizeComplaintText, tokensOf } = require('./normalize');

// Contiguous word-sequence match on the NORMALIZED text (all tokens, including
// stop words, so phrases like "refund the full amount" survive). Word-boundary
// safe: "late" never matches inside "related".
function phraseOccurs(textWords, phraseWords) {
  if (textWords.length < phraseWords.length || phraseWords.length === 0) return false;
  outer: for (let i = 0; i + phraseWords.length <= textWords.length; i++) {
    for (let k = 0; k < phraseWords.length; k++) {
      if (textWords[i + k] !== phraseWords[k]) continue outer;
    }
    return true;
  }
  return false;
}

/**
 * Extracts structured evidence from one complaint text.
 *
 * Returns:
 *   { categories: [...], keywords: [...], phrases: [...], textLength }
 * All arrays are deduplicated and sorted for determinism. textLength is the
 * length of the original (raw) input text.
 */
function extractComplaintEvidence(text) {
  if (typeof text !== 'string') {
    return { categories: [], keywords: [], phrases: [], textLength: 0 };
  }

  const rawLength = text.length;
  const normalized = normalizeComplaintText(text);
  const textWords = normalized.length ? normalized.split(' ') : [];
  const tokenSet = new Set(tokensOf(normalized));

  const categories = [];
  const keywords = [];
  const phrases = [];

  const categoryNames = Object.keys(config.evidenceCategories).sort();
  for (const category of categoryNames) {
    const vocab = config.evidenceCategories[category];
    const matchedKeywords = (vocab.keywords || []).filter((k) => tokenSet.has(k));
    const matchedPhrases = (vocab.phrases || []).filter((p) =>
      phraseOccurs(textWords, p.split(' '))
    );
    if (matchedKeywords.length > 0 || matchedPhrases.length > 0) {
      categories.push(category);
      keywords.push(...matchedKeywords);
      phrases.push(...matchedPhrases);
    }
  }

  return {
    categories,
    keywords: [...new Set(keywords)].sort(),
    phrases: [...new Set(phrases)].sort(),
    textLength: rawLength,
  };
}

module.exports = { extractComplaintEvidence };