const puppeteer = require('puppeteer-core');
const fs = require('fs');

const paths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

let executablePath = '';
for (const p of paths) {
  if (fs.existsSync(p)) {
    executablePath = p;
    break;
  }
}

if (!executablePath) {
  console.error("Could not find Chrome or Edge.");
  process.exit(1);
}

const BASE_URL = 'http://localhost:5173';

(async () => {
  console.log('Using browser at:', executablePath);
  const browser = await puppeteer.launch({
    executablePath,
    defaultViewport: { width: 1440, height: 900 }
  });
  const page = await browser.newPage();
  
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  console.log('Navigating to dashboard...');
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
  await wait(5000);
  await page.screenshot({ path: 'docs/screenshots/dashboard.png' });
  console.log('Saved dashboard.png');

  console.log('Navigating to triage...');
  await page.goto(`${BASE_URL}/triage`, { waitUntil: 'networkidle2' });
  await wait(5000);
  await page.screenshot({ path: 'docs/screenshots/triage.png' });
  console.log('Saved triage.png');

  console.log('Extracting an investigation link from triage page...');
  const investigationHref = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const invLink = links.find(l => l.href.includes('/investigations/'));
    return invLink ? invLink.href : null;
  });

  if (investigationHref) {
    console.log('Navigating to investigation:', investigationHref);
    await page.goto(investigationHref, { waitUntil: 'networkidle2' });
  } else {
    console.log('Fallback to cust_00073');
    await page.goto(`${BASE_URL}/investigations/cust_00073`, { waitUntil: 'networkidle2' });
  }
  await wait(5000);
  await page.screenshot({ path: 'docs/screenshots/investigation.png' });
  console.log('Saved investigation.png');

  console.log('Navigating to rings list...');
  await page.goto(`${BASE_URL}/rings`, { waitUntil: 'networkidle2' });
  await wait(3000);
  
  console.log('Clicking the first ring in the list...');
  const ringClicked = await page.evaluate(() => {
    const firstRow = document.querySelector('tbody tr');
    if (firstRow) {
      firstRow.click();
      return true;
    }
    return false;
  });

  if (ringClicked) {
    console.log('Ring clicked. Waiting for graph to load...');
    await wait(5000);
    await page.screenshot({ path: 'docs/screenshots/ring_graph.png' });
    console.log('Saved ring_graph.png');
  } else {
    console.log('Failed to find a ring in the table. Using fallback ID 1.');
    await page.goto(`${BASE_URL}/rings/1`, { waitUntil: 'networkidle2' });
    await wait(5000);
    await page.screenshot({ path: 'docs/screenshots/ring_graph.png' });
    console.log('Saved ring_graph.png');
  }

  console.log('Navigating to system...');
  await page.goto(`${BASE_URL}/system`, { waitUntil: 'networkidle2' });
  await wait(5000);
  await page.screenshot({ path: 'docs/screenshots/system.png' });
  console.log('Saved system.png');

  await browser.close();
  console.log('Done!');
})();
