/**
 * Dataset-level and per-customer complaint analysis.
 *
 * Everything here is deterministic:
 *   - template keys come from the canonical (sorted) token set of a complaint
 *   - similarity pairs are ordered deterministically (see similarity.js)
 *   - customer results sort by contribution desc, then customerId asc
 *
 * Ground-truth cluster membership is NEVER used: templates, similarity, and
 * the per-customer NLP contribution derive only from the complaint text.
 */

const config = require('./config');
const { normalizeComplaintText, tokensOf } = require('./normalize');
const { findSimilarComplaints } = require('./similarity');
const { extractComplaintEvidence } = require('./evidence');

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function compareIds(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Groups complaints into "templates" = identical normalized vocabulary
 * (canonical sorted token set). Exact duplicate strings are not required:
 * any two complaints with the same token form share a template. Reports only
 * groups with at least config.templates.minCount members.
 */
function findRepeatedTemplates(complaints) {
  const groups = new Map(); // templateKey -> { complaintIds:Set, byId:Map }
  const list = Array.isArray(complaints) ? complaints : [];

  for (const complaint of list) {
    if (!complaint || !complaint.complaintId) continue;
    const key = canonicalTokenKey(complaint.text);
    if (!key) continue; // no analyzable content

    if (!groups.has(key)) groups.set(key, { complaintIds: new Set(), byId: new Map() });
    const group = groups.get(key);
    group.complaintIds.add(complaint.complaintId);
    group.byId.set(complaint.complaintId, complaint);
  }

  const templates = [];
  for (const [key, group] of groups.entries()) {
    if (group.complaintIds.size < config.templates.minCount) continue;

    // Representative = original text of the lexicographically smallest ID.
    const ids = [...group.complaintIds].sort(compareIds);
    const representative = group.byId.get(ids[0]);

    const customerIds = [...new Set(ids.map((id) => group.byId.get(id).customerId))].sort(compareIds);

    templates.push({
      templateKey: key,
      complaintIds: ids,
      customerIds,
      count: ids.length,
      representativeText: representative ? representative.text : '',
      normalizedText: representative ? normalizeComplaintText(representative.text) : key,
    });
  }

  templates.sort(
    (a, b) =>
      b.count - a.count || compareIds(a.templateKey, b.templateKey) || compareIds(a.complaintIds[0], b.complaintIds[0])
  );
  return templates;
}

function canonicalTokenKey(text) {
  return tokensOf(text).sort(compareIds).join(' ');
}

/**
 * Per-customer NLP analysis.
 *
 *   customerId                        - the analyzed customer
 *   complaintCount                    - complaints filed by this customer
 *   evidence                          - categories/keywords/phrases across their complaints
 *   similarComplaintCount             - distinct complaints of this customer that closely
 *                                       match a complaint from a DIFFERENT customer
 *   repeatedTemplateCount             - reused templates their complaints belong to that
 *                                       are also filed by other customers
 *   nlpContribution                   - bounded [0, config.nlp.maxContribution]
 *   explanation                       - human-readable reasons (deterministic order)
 *
 * options.similarPairs / options.templates may be passed in to avoid
 * recomputing dataset-wide structures (see analyzeComplaints).
 */
function analyzeCustomerComplaints(customerId, complaints, options = {}) {
  const all = Array.isArray(complaints) ? complaints : [];
  const mine = all
    .filter((c) => c && c.customerId === customerId)
    .sort((a, b) => compareIds(a.complaintId, b.complaintId));

  const complaintCount = mine.length;
  const evidence = mergeEvidence(mine);

  const pairs = options.similarPairs || findSimilarComplaints(all);
  const templates = options.templates || findRepeatedTemplates(all);

  // Pairs where one side is this customer and the other is a different customer.
  const crossPairs = pairs.filter(
    (p) =>
      (p.customerIdA === customerId && p.customerIdB !== customerId) ||
      (p.customerIdB === customerId && p.customerIdA !== customerId)
  );
  const crossComplaintIds = new Set();
  for (const p of crossPairs) {
    if (p.customerIdA === customerId) crossComplaintIds.add(p.complaintIdA);
    if (p.customerIdB === customerId) crossComplaintIds.add(p.complaintIdB);
  }
  const similarComplaintCount = crossComplaintIds.size;

  // Reused templates involving this customer AND at least one other customer.
  const mineIds = new Set(mine.map((c) => c.complaintId));
  const reusedTemplates = templates.filter(
    (t) => t.customerIds.length >= 2 && t.complaintIds.some((id) => mineIds.has(id))
  );
  const repeatedTemplateCount = reusedTemplates.length;

  const nlpContribution = computeContribution({ similarComplaintCount, repeatedTemplateCount });
  const explanation = buildExplanation(customerId, crossPairs, mine, repeatedTemplateCount, similarComplaintCount);

  return {
    customerId,
    complaintCount,
    evidence,
    similarComplaintCount,
    repeatedTemplateCount,
    nlpContribution,
    explanation,
  };
}

function mergeEvidence(mine) {
  const categories = new Set();
  const keywords = new Set();
  const phrases = new Set();
  for (const complaint of mine) {
    const evidence = extractComplaintEvidence(complaint.text);
    for (const c of evidence.categories) categories.add(c);
    for (const k of evidence.keywords) keywords.add(k);
    for (const p of evidence.phrases) phrases.add(p);
  }
  return {
    categories: [...categories].sort(),
    keywords: [...keywords].sort(),
    phrases: [...phrases].sort(),
  };
}

function computeContribution({ similarComplaintCount, repeatedTemplateCount }) {
  const cfg = config.nlp;
  const templateScore = Math.min(repeatedTemplateCount * cfg.perReusedTemplate, cfg.templateCap);
  const similarScore = Math.min(similarComplaintCount * cfg.perSimilarComplaint, cfg.similarCap);
  return clamp(templateScore + similarScore, 0, cfg.maxContribution);
}

function buildExplanation(customerId, crossPairs, mine, repeatedTemplateCount, similarComplaintCount) {
  const lines = [];
  if (similarComplaintCount > 0) {
    const own = new Set(mine.map((c) => c.complaintId));
    const strongest = [...crossPairs]
      .filter((p) => own.has(p.complaintIdA) || own.has(p.complaintIdB))
      .sort(
        (a, b) =>
          b.similarity - a.similarity ||
          compareIds(a.complaintIdA, b.complaintIdA) ||
          compareIds(a.complaintIdB, b.complaintIdB)
      )[0];
    lines.push(
      `${similarComplaintCount} of the customer's complaint${similarComplaintCount === 1 ? '' : 's'} closely match complaint(s) from other customers.`
    );
    if (strongest) {
      const otherComplaintId =
        strongest.customerIdA === customerId ? strongest.complaintIdB : strongest.complaintIdA;
      const otherCustomerId =
        strongest.customerIdA === customerId ? strongest.customerIdB : strongest.customerIdA;
      lines.push(
        `Strongest match: similarity ${strongest.similarity.toFixed(2)} with complaint ${otherComplaintId} (customer ${otherCustomerId}).`
      );
    }
  }
  if (repeatedTemplateCount > 0) {
    lines.push(
      `Customer reuses ${repeatedTemplateCount} wording template${repeatedTemplateCount === 1 ? '' : 's'} also filed by other customers.`
    );
  }
  if (lines.length === 0) {
    lines.push('No text-based similarity or template reuse detected for this customer\'s complaints.');
  }
  return lines;
}

/**
 * Full deterministic dataset-level analysis report.
 *
 *   totalComplaints          - number of complaints
 *   customersWithComplaints  - distinct customers that filed complaints
 *   similarPairCount         - similar complaint pairs above threshold
 *   repeatedTemplateCount    - repeated wording templates
 *   strongPairs              - top-N similar pairs (similarity desc)
 *   mostReusedTemplates      - top-N templates (count desc)
 *   categoryDistribution     - complaints per evidence category (count desc)
 *   perCustomerResults       - customer-level analysis, contribution desc
 */
function analyzeComplaints(complaints) {
  const list = Array.isArray(complaints) ? complaints.filter((c) => c && c.complaintId) : [];
  const pairs = findSimilarComplaints(list);
  const templates = findRepeatedTemplates(list);

  // Evidence-category distribution (count of complaints per category).
  const categoryCounts = {};
  for (const complaint of list) {
    for (const category of extractComplaintEvidence(complaint.text).categories) {
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    }
  }
  const categoryDistribution = Object.keys(categoryCounts)
    .map((category) => ({ category, count: categoryCounts[category] }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  const customerIds = [...new Set(list.map((c) => c.customerId))].sort(compareIds);
  const perCustomerResults = customerIds
    .map((customerId) =>
      analyzeCustomerComplaints(customerId, list, { similarPairs: pairs, templates })
    )
    .sort(
      (a, b) =>
        b.nlpContribution - a.nlpContribution || compareIds(a.customerId, b.customerId)
    );

  return {
    totalComplaints: list.length,
    customersWithComplaints: customerIds.length,
    similarPairCount: pairs.length,
    repeatedTemplateCount: templates.length,
    strongPairs: pairs.slice(0, config.similarity.maxTopPairs),
    mostReusedTemplates: templates.slice(0, config.similarity.maxTopTemplates),
    categoryDistribution,
    perCustomerResults,
  };
}

module.exports = { findRepeatedTemplates, analyzeCustomerComplaints, analyzeComplaints };