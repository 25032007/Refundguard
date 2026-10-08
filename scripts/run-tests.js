const { spawnSync } = require('child_process');

const suites = {
  risk: 'risk:test',
  nlp: 'nlp:test',
  graph: 'graph:test',
  data: 'data:test',
  'data-ci': 'data:ci',
  eval: 'eval:test',
  backend: 'backend:test',
  frontend: 'frontend:test'
};

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/run-tests.js [suite1] [suite2] ...');
  process.exit(1);
}

let hasError = false;

for (const suiteName of args) {
  const script = suites[suiteName];
  if (!script) {
    console.error(`Unknown suite: ${suiteName}`);
    hasError = true;
    continue;
  }

  console.log(`\n======================================================`);
  console.log(`Running suite: ${suiteName}`);
  console.log(`======================================================\n`);

  const isWindows = process.platform === 'win32';

  const result = spawnSync('npm', ['run', script], {
    stdio: 'inherit',
    shell: isWindows
  });

  if (result.error) {
    console.error(`Error executing ${suiteName}:`, result.error);
    hasError = true;
  } else if (result.status !== 0) {
    console.error(`Suite ${suiteName} failed with exit code ${result.status}`);
    hasError = true;
  } else {
    console.log(`Suite ${suiteName} passed!`);
  }
}

if (hasError) {
  console.error('\nOne or more test suites failed.');
  process.exit(1);
} else {
  console.log('\nAll test suites passed successfully.');
  process.exit(0);
}
