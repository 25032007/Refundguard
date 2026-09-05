/**
 * Connected components over the customer-focused graph using BFS.
 *
 * Deterministic: components are returned with sorted member IDs, ordered by
 * size descending then first member ascending.
 */

/**
 * @param {{ adjacency: Map<string, string[]> }} customerGraph
 * @returns {Array<string[]>} components, each an ascending list of customerIds
 */
function findConnectedComponents(customerGraph) {
  const visited = new Set();
  const components = [];

  const customers = [...customerGraph.adjacency.keys()].sort();

  for (const start of customers) {
    if (visited.has(start)) continue;

    const component = [];
    const queue = [start];
    visited.add(start);

    while (queue.length > 0) {
      const current = queue.shift();
      component.push(current);
      const neighbors = customerGraph.adjacency.get(current) || [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }

    component.sort();
    components.push(component);
  }

  components.sort(
    (a, b) => b.length - a.length || (a[0] < b[0] ? -1 : 1)
  );

  return components;
}

module.exports = { findConnectedComponents };