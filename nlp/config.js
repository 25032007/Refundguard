/**
 * Complaint NLP & Evidence Extraction — configuration.
 *
 * Single source of truth for:
 *   - the stop-word list and tokenizer settings
 *   - the similarity threshold and report limits
 *   - the repeated-template minimum count
 *   - the evidence-category vocabulary (keywords + phrases, all normalized)
 *   - the per-customer NLP contribution formula
 *
 * The evidence vocabulary mirrors the patterns that actually occur in
 * data/raw/complaints.json (spare use of magic values elsewhere).
 */

const STOP_WORDS = [
  'a', 'about', 'after', 'again', 'all', 'am', 'an', 'and', 'any', 'are',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'between', 'but',
  'by', 'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during',
  'each', 'few', 'for', 'from', 'further', 'get', 'go', 'got', 'had', 'has',
  'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'i', 'if', 'im', 'in', 'into', 'is', 'it', 'its', 'itself',
  'ive', 'just', 'like', 'me', 'more', 'most', 'much', 'my', 'myself',
  'need', 'needs', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 'please', 'same', 'she',
  'should', 'so', 'some', 'still', 'such', 'than', 'that', 'the', 'their',
  'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was',
  'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom',
  'why', 'will', 'with', 'would', 'wants', 'you', 'your', 'yours',
  // Domain-frequent but low-signal tokens
  'look', 'looks', 'took', 'due', 'yes', 'well',
];

// These tokens carry investigation meaning (negations, refund vocabulary) and
// are deliberately NOT stop words, even though generic lists would drop them.
const PROTECTED_TOKENS = ['not', 'no', 'never', 'refund', 'order', 'delivery', 'received'];

const similarity = {
  // Minimum similarity score for two complaints to be reported as similar.
  // Empirical study of data/raw/complaints.json: identical reused wording
  // scores 1.0 and same-theme variants score ~0.5; cross-theme pairs stay
  // well below 0.5, so this boundary cleanly separates real near-reuse.
  threshold: 0.5,
  // Upper bounds for report sections (keep CLI output bounded).
  maxTopPairs: 10,
  maxTopTemplates: 10,
};

const templates = {
  // A wording template only counts as "repeated" when at least this many
  // complaints (across one or more customers) share the same token form.
  minCount: 2,
};

const nlp = {
  // Bounded per-customer contribution (fixed maximum).
  maxContribution: 15,
  // contribution = min(reusedTemplates * perReusedTemplate, templateCap)
  //               + min(similarComplaints * perSimilarComplaint, similarCap)
  perReusedTemplate: 3,
  templateCap: 9,
  perSimilarComplaint: 2,
  similarCap: 6,
};

/**
 * Evidence vocabulary. Each category fires when ANY of its keywords is present
 * in the complaint's token set OR ANY of its phrases occurs as a contiguous
 * word sequence in the normalized text. Phrases are stored in normalized form
 * (lowercase, punctuation stripped, single spaces).
 */
const evidenceCategories = {
  refund_issue: {
    keywords: ['refund', 'refunded'],
    phrases: [
      'process my refund', 'process the refund', 'request a refund',
      'requested a refund', 'refund request', 'refund requested',
      'need a refund', 'needs a refund', 'refund needed', 'refund please',
      'refund the full amount', 'refund the extra charge', 'refund immediately',
      'refund back', 'refunded', 'issuing refund', 'full refund',
      'complete refund', 'refund not received',
    ],
  },
  delivery_issue: {
    keywords: ['delivery', 'delivered', 'parcel', 'package', 'shipped', 'shipping'],
    phrases: [
      'never received', 'never arrived', 'never came', 'never delivered',
      'marked delivered', 'shows as delivered', 'delivery failed',
      'failed delivery attempts', 'lost in delivery', 'delivery attempts',
      'wrong city', 'left out', 'days late', 'did not come',
    ],
  },
  damage_issue: {
    keywords: ['damaged', 'broken', 'crushed', 'missing'],
    phrases: ['arrived damaged', 'arrived broken', 'box crushed', 'items missing'],
  },
  wrong_item_issue: {
    keywords: ['wrong', 'incorrect'],
    phrases: ['wrong item', 'wrong product', 'wrong city', 'does not match the color', 'does not match my order'],
  },
  duplicate_charge: {
    keywords: ['twice', 'duplicate'],
    phrases: [
      'charged twice', 'duplicate charge', 'duplicate payment',
      'charged for the same order', 'extra charge', 'charge refunded',
    ],
  },
  quality_issue: {
    keywords: ['quality', 'poor'],
    phrases: [
      'not as described', 'does not perform', 'differs from',
      'lower than expected', 'not what was advertised', 'does not match the listing',
    ],
  },
  product_issue: {
    keywords: ['size', 'suitable', 'fabric', 'color'],
    phrases: ['not suitable', 'trouble using', 'color i selected'],
  },
  payment_issue: {
    keywords: ['billing', 'charged', 'payment', 'confirmation', 'receipt', 'email', 'card'],
    phrases: [
      'billing address', 'confirmation email', 'receipt is incorrect',
      'payment was processed', 'no confirmation',
    ],
  },
  service_issue: {
    keywords: ['service'],
    phrases: ['took too long', 'customer service'],
  },
};

module.exports = {
  STOP_WORDS,
  PROTECTED_TOKENS,
  similarity,
  templates,
  nlp,
  evidenceCategories,
};