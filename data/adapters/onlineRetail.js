const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { faker } = require('@faker-js/faker');

const PROCESSED_CSV = path.join(__dirname, '..', 'processed', 'online-retail-ii.csv');
const OUTPUT_DIR = path.join(__dirname, '..', 'generated', 'uci');

// Config
const TARGET_CUSTOMERS = 2000;
const EXCLUDED_CODES = new Set(['POST', 'M', 'D', 'S', 'BANK CHARGES', 'ADJUST', 'AMAZONFEE', 'PADS', 'CRUK']);
const OUTLIER_CUSTOMER = '16446'; 

function makeId(prefix, idStr) {
  return `${prefix}_${idStr}`;
}

async function loadAndProfileCSV(csvPath) {
  return new Promise((resolve, reject) => {
    const customerStats = {};
    const rawLines = [];

    let totalSourceRows = 0;
    let missingCustomerIdRows = 0;
    let outlierRows = 0;

    if (!fs.existsSync(csvPath)) return resolve({ customerStats, rawLines, totalSourceRows, missingCustomerIdRows, outlierRows });

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        totalSourceRows++;
        const customerId = row['Customer ID'] || row['CustomerID'];
        if (!customerId) {
          missingCustomerIdRows++;
          return;
        }
        if (customerId === OUTLIER_CUSTOMER) {
          outlierRows++;
          return;
        }

        const stockCode = row['StockCode'].trim().toUpperCase();
        const quantity = parseFloat(row['Quantity']) || 0;
        const invoice = row['Invoice'];
        const isCancellation = invoice.startsWith('C');

        if (EXCLUDED_CODES.has(stockCode)) return;
        if (quantity < 0 && !isCancellation) return;

        const timestamp = new Date(row['InvoiceDate']).getTime();

        if (!customerStats[customerId]) {
          customerStats[customerId] = {
            id: customerId,
            lineItems: 0,
            firstSeen: Number.MAX_SAFE_INTEGER
          };
        }
        
        customerStats[customerId].lineItems++;
        if (timestamp < customerStats[customerId].firstSeen) {
          customerStats[customerId].firstSeen = timestamp;
        }

        rawLines.push({
          invoice,
          stockCode,
          quantity,
          price: parseFloat(row['Price']) || 0,
          customerId,
          timestamp,
          isCancellation,
          country: row['Country']
        });
      })
      .on('end', () => {
        resolve({ customerStats, rawLines, totalSourceRows, missingCustomerIdRows, outlierRows });
      })
      .on('error', reject);
  });
}

function sampleCustomers(customerStats, targetCount) {
  const allCustomers = Object.values(customerStats);
  allCustomers.sort((a, b) => a.lineItems - b.lineItems);
  
  const buckets = [
    allCustomers.slice(0, Math.floor(allCustomers.length * 0.25)),
    allCustomers.slice(Math.floor(allCustomers.length * 0.25), Math.floor(allCustomers.length * 0.5)),
    allCustomers.slice(Math.floor(allCustomers.length * 0.5), Math.floor(allCustomers.length * 0.75)),
    allCustomers.slice(Math.floor(allCustomers.length * 0.75))
  ];

  const selectedCustomers = new Set();
  const perBucket = Math.ceil(targetCount / (buckets.length || 1));

  for (const bucket of buckets) {
    const shuffled = faker.helpers.shuffle(bucket);
    for (let i = 0; i < perBucket && i < shuffled.length && selectedCustomers.size < targetCount; i++) {
      selectedCustomers.add(shuffled[i].id);
    }
  }
  
  if (selectedCustomers.size < targetCount) {
    const remaining = allCustomers.filter(c => !selectedCustomers.has(c.id));
    const shuffledRemaining = faker.helpers.shuffle(remaining);
    let i = 0;
    while (selectedCustomers.size < targetCount && i < shuffledRemaining.length) {
      selectedCustomers.add(shuffledRemaining[i].id);
      i++;
    }
  }

  return selectedCustomers;
}

function processData(rawLines, selectedCustomerIds, targetCount) {
  const customers = [];
  const finalTransactions = [];
  const refunds = [];
  const complaints = [];
  const devices = [];

  rawLines.sort((a, b) => a.timestamp - b.timestamp);

  const customerTxGroups = {};
  const customerRefundGroups = {};

  for (const line of rawLines) {
    if (!selectedCustomerIds.has(line.customerId)) continue;
    
    if (line.isCancellation) {
      if (!customerRefundGroups[line.invoice]) customerRefundGroups[line.invoice] = { items: [], meta: line };
      customerRefundGroups[line.invoice].items.push(line);
    } else {
      if (!customerTxGroups[line.invoice]) customerTxGroups[line.invoice] = { items: [], meta: line };
      customerTxGroups[line.invoice].items.push(line);
    }
  }

  const cIdList = Array.from(selectedCustomerIds);
  faker.helpers.shuffle(cIdList);
  
  const customerIPs = {};
  const customerDevices = {};
  const customerGroupType = {};
  
  // Configurable Synthetic Benchmark Proportions
  const LEGITIMATE_DISTRIBUTION = {
    INDIVIDUAL: 0.82,  // 82%
    HOUSEHOLD: 0.08,   // 8%
    OFFICE: 0.05,      // 5%
    HOSTEL: 0.02,      // 2%
    WHOLESALER: 0.03   // 3%
  };

  const targetCounts = {
    HOUSEHOLD: Math.floor(cIdList.length * LEGITIMATE_DISTRIBUTION.HOUSEHOLD),
    OFFICE: Math.floor(cIdList.length * LEGITIMATE_DISTRIBUTION.OFFICE),
    HOSTEL: Math.floor(cIdList.length * LEGITIMATE_DISTRIBUTION.HOSTEL),
    WHOLESALER: Math.floor(cIdList.length * LEGITIMATE_DISTRIBUTION.WHOLESALER)
  };
  
  let currentCounts = { HOUSEHOLD: 0, OFFICE: 0, HOSTEL: 0, WHOLESALER: 0 };

  let cIdx = 0;
  while (cIdx < cIdList.length) {
    let groupSize = 1;
    let groupType = 'LEGITIMATE_NORMAL';
    
    if (currentCounts.HOUSEHOLD < targetCounts.HOUSEHOLD) {
      groupSize = faker.number.int({ min: 2, max: 5 });
      groupType = 'LEGITIMATE_HOUSEHOLD';
      currentCounts.HOUSEHOLD += groupSize;
    } else if (currentCounts.OFFICE < targetCounts.OFFICE) {
      groupSize = faker.number.int({ min: 5, max: 15 });
      groupType = 'LEGITIMATE_OFFICE';
      currentCounts.OFFICE += groupSize;
    } else if (currentCounts.HOSTEL < targetCounts.HOSTEL) {
      groupSize = faker.number.int({ min: 10, max: 30 });
      groupType = 'LEGITIMATE_HOSTEL';
      currentCounts.HOSTEL += groupSize;
    } else if (currentCounts.WHOLESALER < targetCounts.WHOLESALER) {
      groupSize = faker.number.int({ min: 3, max: 8 });
      groupType = 'LEGITIMATE_WHOLESALER';
      currentCounts.WHOLESALER += groupSize;
    }
    
    const sharedIp = faker.internet.ipv4();
    const sharedDevice = makeId('dev', faker.string.alphanumeric(8));
    
    for (let i = 0; i < groupSize && cIdx < cIdList.length; i++) {
      const cid = cIdList[cIdx];
      customerIPs[cid] = sharedIp;
      customerGroupType[cid] = groupType;
      
      const personalDevice = makeId('dev', faker.string.alphanumeric(8));
      customerDevices[cid] = [personalDevice];
      
      if (groupType === 'LEGITIMATE_HOUSEHOLD' && faker.datatype.boolean()) {
        customerDevices[cid].push(sharedDevice);
      }
      
      devices.push({
        deviceId: personalDevice,
        customerId: cid,
        deviceType: faker.helpers.arrayElement(['mobile', 'desktop', 'tablet']),
        os: faker.helpers.arrayElement(['iOS', 'Android', 'Windows', 'macOS']),
        browser: faker.helpers.arrayElement(['Chrome', 'Safari', 'Firefox', 'Edge'])
      });
      
      if (groupType === 'LEGITIMATE_HOUSEHOLD' && i === 0) {
         devices.push({
          deviceId: sharedDevice,
          customerId: cid,
          deviceType: faker.helpers.arrayElement(['mobile', 'desktop', 'tablet']),
          os: faker.helpers.arrayElement(['iOS', 'Android', 'Windows', 'macOS']),
          browser: faker.helpers.arrayElement(['Chrome', 'Safari', 'Firefox', 'Edge'])
        });
      }
      cIdx++;
    }
  }

  const accountCreationMap = {};
  
  for (const cid of selectedCustomerIds) {
    const ts = rawLines.find(r => r.customerId === cid)?.timestamp || new Date('2011-12-09T00:00:00Z').getTime();
    const accountCreatedAt = faker.date.past({ years: 1, refDate: new Date(ts) }).toISOString();
    accountCreationMap[cid] = accountCreatedAt;
    
    customers.push({
      customerId: cid,
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      phone: faker.phone.number(),
      status: 'active',
      createdAt: accountCreatedAt
    });
  }

  const customerTxList = {};
  
  for (const invoice of Object.keys(customerTxGroups)) {
    const group = customerTxGroups[invoice];
    const meta = group.meta;
    let amount = 0;
    const items = [];
    
    for (const item of group.items) {
      amount += item.quantity * item.price;
      items.push(item.stockCode);
    }
    
    const txn = {
      transactionId: makeId('txn', invoice),
      customerId: meta.customerId,
      orderId: makeId('ord', invoice),
      amount: parseFloat(amount.toFixed(2)),
      currency: 'GBP',
      paymentMethod: faker.helpers.arrayElement(['card', 'paypal', 'bank_transfer']),
      deviceId: faker.helpers.arrayElement(customerDevices[meta.customerId] || []),
      ipAddress: customerIPs[meta.customerId],
      status: 'completed',
      createdAt: new Date(meta.timestamp).toISOString(),
      items,
      _itemsRaw: group.items.map(i => ({...i, availableQuantity: i.quantity}))
    };
    
    finalTransactions.push(txn);
    if (!customerTxList[meta.customerId]) customerTxList[meta.customerId] = [];
    customerTxList[meta.customerId].push(txn);
  }

  let fullyLinked = 0;
  let anyLinked = 0;
  let unlinked = 0;
  let ambiguous = 0;
  let totalRefundAmount = 0;

  const COMPLAINT_TEMPLATES = {
    'damaged': [
      'The item arrived damaged and I would like a refund.',
      'The product was damaged when it arrived.',
      'I received the item with visible damage.',
      'The box was crushed and the item inside is broken.',
      'This arrived in pieces. Please refund.',
      'Item has scratches and dents all over.',
      'Arrived shattered, completely unusable.',
      'The packaging was fine but the product is damaged.',
      'Broken upon arrival. I need my money back.',
      'It looks like it was dropped during shipping, damaged.'
    ],
    'wrong item': [
      'I received the wrong item in my order.',
      'This is not what I ordered.',
      'You sent me the incorrect product.',
      'Wrong color and wrong size delivered.',
      'I ordered something else, please refund this wrong item.',
      'The item in the box does not match the invoice.',
      'Sent the wrong model entirely.',
      'Incorrect item shipped to me.',
      'I got someone else\'s order instead of mine.',
      'This isn\'t what was pictured on the site.'
    ],
    'not as expected': [
      'The product does not perform as described.',
      'Quality is much lower than expected.',
      'The material feels cheap, not as expected.',
      'It doesn\'t look like the photos online.',
      'Very disappointed with the item quality.',
      'Does not fit the description provided.',
      'Not what I was hoping for, requesting a refund.',
      'The features described are missing.',
      'Poorly made and not up to standard.',
      'I expected better based on the reviews.'
    ],
    'quantity issue': [
      'I ordered multiple but only received one.',
      'Missing parts from the package.',
      'The quantity delivered is incorrect.',
      'Short shipped. I did not get everything I paid for.',
      'Half the order is missing from the box.',
      'Only partial delivery received.',
      'Box says 10 but there are only 8 inside.',
      'Did not receive the full quantity requested.',
      'Missing items in the shipment.',
      'Incomplete order arrived, missing pieces.'
    ],
    'delivery issue': [
      'Received my order but the delivery was several days late.',
      'Order never reached my address.',
      'The delivery was delayed past the promised date.',
      'Tracking said delivered but it arrived a week later.',
      'Terrible shipping experience, very late.',
      'I had to go pick it up myself from the depot.',
      'The courier left it in the rain.',
      'Package was lost for weeks before arriving.',
      'Arrived too late for the event I needed it for.',
      'Delivery took much longer than estimated.'
    ]
  };
  const REASONS = Object.keys(COMPLAINT_TEMPLATES);

  for (const invoice of Object.keys(customerRefundGroups)) {
    const group = customerRefundGroups[invoice];
    const meta = group.meta;
    
    let amount = 0;
    let isFullyLinked = true;
    let isAnyLinked = false;
    let isAmbiguous = false;
    
    const candidatesTxs = customerTxList[meta.customerId] || [];
    let bestTxnId = null;
    
    for (const item of group.items) {
      const requiredQ = Math.abs(item.quantity);
      amount += requiredQ * item.price;
      
      let candidates = candidatesTxs.filter(tx => 
        new Date(tx.createdAt).getTime() <= item.timestamp
      );
      
      const eligibleTxs = [];
      for (const tx of candidates) {
        const matchingLine = tx._itemsRaw.find(li => li.stockCode === item.stockCode && li.availableQuantity >= requiredQ);
        if (matchingLine) {
          eligibleTxs.push({ tx, line: matchingLine });
        }
      }
      
      if (eligibleTxs.length > 0) {
        if (eligibleTxs.length > 1) isAmbiguous = true;
        eligibleTxs.sort((a, b) => new Date(b.tx.createdAt).getTime() - new Date(a.tx.createdAt).getTime());
        const matchedTxn = eligibleTxs[0];
        matchedTxn.line.availableQuantity -= requiredQ;
        isAnyLinked = true;
        if (!bestTxnId) bestTxnId = matchedTxn.tx.transactionId;
      } else {
        isFullyLinked = false;
      }
    }
    
    if (isAnyLinked) anyLinked++;
    if (isFullyLinked) fullyLinked++;
    if (!isAnyLinked) unlinked++;
    if (isAmbiguous) ambiguous++;
    
    totalRefundAmount += amount;
    
    const refundId = makeId('ref', invoice);
    const ts = new Date(meta.timestamp);
    
    refunds.push({
      refundId,
      transactionId: isAnyLinked ? bestTxnId : null,
      customerId: meta.customerId,
      orderId: isAnyLinked ? bestTxnId.replace('txn_', 'ord_') : null,
      amount: parseFloat(amount.toFixed(2)),
      reason: faker.helpers.arrayElement(REASONS),
      status: 'processed',
      requestedAt: ts.toISOString(),
      processedAt: ts.toISOString()
    });
    
    if (faker.number.int({ min: 1, max: 100 }) <= 40) {
        const reason = refunds[refunds.length - 1].reason;
        complaints.push({
          complaintId: makeId('comp', complaints.length),
          customerId: meta.customerId,
          orderId: isAnyLinked ? bestTxnId.replace('txn_', 'ord_') : null,
          refundId,
          text: faker.helpers.arrayElement(COMPLAINT_TEMPLATES[reason]),
          category: 'refund',
          status: 'resolved',
          createdAt: ts.toISOString(),
        });
    }
  }

  finalTransactions.forEach(tx => delete tx._itemsRaw);
  
  const groundTruth = {
    seed: process.env.CURRENT_SEED || 1, // handled in main
    customers: {},
    scenarios: []
  };
  
  for (const cid of selectedCustomerIds) {
    let baseCategory = customerGroupType[cid] || 'LEGITIMATE_NORMAL';
    let categories = [baseCategory];
    
    // Check if high refund rate
    const txCount = customerTxList[cid] ? customerTxList[cid].length : 0;
    const refCount = refunds.filter(r => r.customerId === cid).length;
    if (txCount > 0 && refCount >= 3 && (refCount / txCount) > 0.3) {
      categories.push('LEGITIMATE_HIGH_REFUND_RATE');
    }
    
    groundTruth.customers[cid] = {
      label: 'LEGITIMATE',
      categories,
      scenarioIds: [],
      memberJoinDate: null
    };
  }

  return {
    customers, transactions: finalTransactions, refunds, complaints, devices, groundTruth,
    stats: {
      fullyLinked, anyLinked, unlinked, ambiguous, totalRefunds: refunds.length, totalRefundAmount
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  const seedIndex = args.indexOf('--seed');
  if (seedIndex === -1) {
    console.error("Please provide a seed using --seed <number>");
    process.exit(1);
  }
  const SEED = parseInt(args[seedIndex + 1], 10);
  if (isNaN(SEED)) {
    console.error("Invalid seed value.");
    process.exit(1);
  }
  
  faker.seed(SEED);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const isTestCommand = ['test', 'data:test', 'eval:test'].includes(process.env.npm_lifecycle_event);
  const mode = process.env.DATASET_MODE || ((isTestCommand || process.env.CI === 'true') ? 'CI_FIXTURE' : 'REAL_UCI');

  console.log(`DATASET_MODE=${mode}`);

  let customerStats, rawLines, totalSourceRows, missingCustomerIdRows, outlierRows;

  if (mode === 'CI_FIXTURE') {
    const fixturePath = path.join(__dirname, '..', 'fixtures', 'ci-online-retail.csv');
    if (!fs.existsSync(fixturePath)) {
      console.error("CI_FIXTURE mode requested but ci-online-retail.csv not found.");
      process.exit(1);
    }
    const fixtureData = await loadAndProfileCSV(fixturePath);
    customerStats = fixtureData.customerStats;
    rawLines = fixtureData.rawLines;
    totalSourceRows = fixtureData.totalSourceRows;
    missingCustomerIdRows = fixtureData.missingCustomerIdRows;
    outlierRows = fixtureData.outlierRows;
  } else {
    // REAL_UCI mode
    const realData = await loadAndProfileCSV(PROCESSED_CSV);
    customerStats = realData.customerStats;
    rawLines = realData.rawLines;
    totalSourceRows = realData.totalSourceRows;
    missingCustomerIdRows = realData.missingCustomerIdRows;
    outlierRows = realData.outlierRows;

    if (totalSourceRows === 0) {
      console.error("REAL_UCI dataset requested but not found. Failing loudly.");
      process.exit(1);
    }
  }

  const selectedCustomerIds = sampleCustomers(customerStats, TARGET_CUSTOMERS);
  const data = processData(rawLines, selectedCustomerIds, TARGET_CUSTOMERS);

  const { injectScenarios } = require('../scenarios/index');
  const scenarioStats = injectScenarios(data, SEED);

  // Normalize dataset: Ensure no customer createdAt date is AFTER their first transaction.
  // The synthetic scenario injectors randomize timestamps independently, which can break chronology.
  for (const c of data.customers) {
    const txs = data.transactions.filter(t => t.customerId === c.customerId);
    if (txs.length > 0) {
      const minTx = Math.min(...txs.map(t => new Date(t.timestamp || t.createdAt).getTime()));
      if (new Date(c.createdAt).getTime() > minTx) {
        // Enforce chronological invariant: account must exist before transactions
        c.createdAt = new Date(minTx - 1000).toISOString();
      }
    }
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'customers.json'), JSON.stringify(data.customers, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'transactions.json'), JSON.stringify(data.transactions, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'refunds.json'), JSON.stringify(data.refunds, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'complaints.json'), JSON.stringify(data.complaints, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'devices.json'), JSON.stringify(data.devices, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'ground-truth.json'), JSON.stringify(data.groundTruth, null, 2));
  

    const groupCounts = {
      individual: 0, household: 0, office: 0, hostel: 0, wholesaler: 0, legitimateHighRefund: 0
    };
    for (const c of Object.values(data.groundTruth.customers)) {
      if (c.categories.includes('LEGITIMATE_NORMAL')) groupCounts.individual++;
      if (c.categories.includes('LEGITIMATE_HOUSEHOLD')) groupCounts.household++;
      if (c.categories.includes('LEGITIMATE_OFFICE')) groupCounts.office++;
      if (c.categories.includes('LEGITIMATE_HOSTEL')) groupCounts.hostel++;
      if (c.categories.includes('LEGITIMATE_WHOLESALER')) groupCounts.wholesaler++;
      if (c.categories.includes('LEGITIMATE_HIGH_REFUND_RATE')) groupCounts.legitimateHighRefund++;
    }
    data.groundTruth.seed = SEED;

    const metadata = {
    source: mode,
    seed: SEED,
    currency: "GBP",
    backgroundCustomerCount: scenarioStats.bgCount,
    injectedFraudCustomerCount: scenarioStats.injectedCount,
    totalCustomerCount: data.customers.length,
    transactionCount: data.transactions.length,
    refundCount: data.refunds.length,
    sourceAccounting: {
      totalSourceRows,
      missingCustomerIdRows,
      outlierRows,
      validSourceRows: rawLines.length
    },
    normalInvoiceCount: data.transactions.length,
    cancellationInvoiceCount: data.stats.totalRefunds,
    linking: {
      fullyLinked: data.stats.fullyLinked,
      partiallyLinked: data.stats.anyLinked - data.stats.fullyLinked,
      unlinked: data.stats.unlinked,
      ambiguous: data.stats.ambiguous
    },
    samplingMethod: "Stratified deterministic seeded sampling by activity",
    deterministicGenerationMethod: "Phase 1B+1C synthetic generator",
    scenarioCounts: {
      obvious_ring: 1,
      noisy_ring: 1,
      rotating_ip_ring: 1,
      slow_burn_ring: 1,
      burst_refund: 1
    },
    accountAgeSource: "synthetic_left_censoring",
    refundDerivation: "cancellation_invoice",
    linkingMethod: "Deterministic heuristic (same customer, prior, same StockCode, sufficient original quantity)",
    excludedCodes: Array.from(EXCLUDED_CODES),
    negativeNonCRows: "Ignored during parsing",
    groups: (function() {
      const counts = { individual: 0, household: 0, office: 0, hostel: 0, wholesaler: 0, legitimateHighRefund: 0 };
      for (const c of Object.values(data.groundTruth.customers)) {
        if (c.categories.includes('LEGITIMATE_NORMAL')) counts.individual++;
        if (c.categories.includes('LEGITIMATE_HOUSEHOLD')) counts.household++;
        if (c.categories.includes('LEGITIMATE_OFFICE')) counts.office++;
        if (c.categories.includes('LEGITIMATE_HOSTEL')) counts.hostel++;
        if (c.categories.includes('LEGITIMATE_WHOLESALER')) counts.wholesaler++;
        if (c.categories.includes('LEGITIMATE_HIGH_REFUND_RATE')) counts.legitimateHighRefund++;
      }
      return {
        legitimateIndividual: counts.individual,
        legitimateHousehold: counts.household,
        legitimateOffice: counts.office,
        legitimateHostel: counts.hostel,
        legitimateWholesaler: counts.wholesaler,
        legitimateHighRefundRate: counts.legitimateHighRefund,
        totalSharedResource: counts.household + counts.office + counts.hostel + counts.wholesaler
      };
    })()
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'metadata.json'), JSON.stringify(metadata, null, 2));
  
  console.log(`Success: Generated ${data.customers.length} customers with seed ${SEED}.`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  loadAndProfileCSV,
  sampleCustomers,
  processData,
  OUTLIER_CUSTOMER,
  EXCLUDED_CODES
};
