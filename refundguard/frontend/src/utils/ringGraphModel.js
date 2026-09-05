/**
 * RefundGuard — ring graph model builder.
 *
 * Pure, browser-agnostic transform: converts the graph evidence returned by
 * the Investigation API (GET /api/v1/investigations/:customerId → `graph`) into
 * `{ nodes, links }` for force-directed visualization.
 *
 * Nothing is invented here: every node and every link is derived either from
 * `graph.members` or from the actual `graph.evidence` strings the backend
 * produces for shared IP / shared device groups.
 */

const SEVERITY_BANDS = [
  { max: 24, label: 'LOW' },
  { max: 49, label: 'MEDIUM' },
  { max: 74, label: 'HIGH' },
  { max: 100, label: 'CRITICAL' },
];

export function severityFromScore(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return null;
  for (const band of SEVERITY_BANDS) {
    if (score <= band.max) return band.label;
  }
  return 'CRITICAL';
}

/**
 * Converts an investigation's graph section into graph-model nodes + links.
 *
 * Node types:
 *   - customer : every ring member (graph.members) plus every customer that
 *     appears in a shared-resource evidence line
 *   - ip       : a shared IP evidence line ("shared IP <ip>: <customers>")
 *   - device   : a shared device evidence line ("shared device <id>: <customers>")
 *
 * Link types (every link maps to a real evidence line):
 *   - shared_ip    : customer ──> ip
 *   - shared_device: customer ──> device
 */
export function buildGraphModel(investigation) {
  const graph = investigation && investigation.graph ? investigation.graph : {};
  const nodes = [];
  const links = [];
  const nodeIndex = new Map();

  const ensureNode = (node) => {
    const existing = nodeIndex.get(node.id);
    if (existing) return existing;
    nodeIndex.set(node.id, node);
    nodes.push(node);
    return node;
  };

  const memberSet = new Set(graph.members || []);
  const addCustomer = (customerId) =>
    ensureNode({ id: customerId, type: 'customer', ringMember: memberSet.has(customerId) });

  for (const memberId of memberSet) addCustomer(memberId);

  for (const line of graph.evidence || []) {
    const ipMatch = line.match(/^shared IP (.+?): (.+)$/);
    if (ipMatch) {
      const ipId = ipMatch[1];
      const customers = ipMatch[2]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      ensureNode({ id: ipId, type: 'ip', connectedCustomers: customers });
      for (const customerId of customers) {
        addCustomer(customerId);
        links.push({ source: customerId, target: ipId, type: 'shared_ip' });
      }
      continue;
    }

    const deviceMatch = line.match(/^shared device (.+?): (.+)$/);
    if (deviceMatch) {
      const deviceId = deviceMatch[1];
      const customers = deviceMatch[2]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      ensureNode({ id: deviceId, type: 'device', connectedCustomers: customers });
      for (const customerId of customers) {
        addCustomer(customerId);
        links.push({ source: customerId, target: deviceId, type: 'shared_device' });
      }
    }
  }

  return { nodes, links };
}

/** Distinct relationship types present in the model (sorted). */
export function relationshipTypesOf(model) {
  const types = new Set(model.links.map((link) => link.type));
  return [...types].sort();
}

/**
 * Plain-text summary of the graph, used as an accessible fallback and intro.
 * Example: "6 customers connected through 1 shared IP and 2 shared devices."
 */
export function buildTextSummary(model) {
  const customerCount = new Set(
    model.nodes.filter((node) => node.type === 'customer').map((node) => node.id)
  ).size;
  const ipCount = model.nodes.filter((node) => node.type === 'ip').length;
  const deviceCount = model.nodes.filter((node) => node.type === 'device').length;

  const resources = [];
  if (ipCount > 0) resources.push(`${ipCount} shared IP${ipCount === 1 ? '' : 's'}`);
  if (deviceCount > 0) resources.push(`${deviceCount} shared device${deviceCount === 1 ? '' : 's'}`);

  const customerPart = `${customerCount} customer${customerCount === 1 ? '' : 's'}`;
  const connectionPart =
    resources.length > 0 ? `connected through ${resources.join(' and ')}.` : 'not connected through any shared resource.';

  return `${customerPart} ${connectionPart}`;
}