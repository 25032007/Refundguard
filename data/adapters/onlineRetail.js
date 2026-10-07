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
  
  let cIdx = 0;
  while (cIdx < cIdList.length) {
    const roll = faker.number.int({ min: 1, max: 100 });
    let groupSize = 1;
    let groupType = 'individual';
    
    if (roll <= 5) { groupSize = faker.number.int({ min: 2, max: 5 }); groupType = 'household'; }
    else if (roll <= 8) { groupSize = faker.number.int({ min: 5, max: 15 }); groupType = 'office'; }
    else if (roll <= 10) { groupSize = faker.number.int({ min: 10, max: 30 }); groupType = 'hostel'; }
    
    const sharedIp = faker.internet.ipv4();
    const sharedDevice = makeId('dev', faker.string.alphanumeric(8));
    
    for (let i = 0; i < groupSize && cIdx < cIdList.length; i++) {
      const cid = cIdList[cIdx];
      customerIPs[cid] = sharedIp;
      
      const personalDevice = makeId('dev', faker.string.alphanumeric(8));
      customerDevices[cid] = [personalDevice];
      
      if (groupType === 'household' && faker.datatype.boolean()) {
        customerDevices[cid].push(sharedDevice);
      }
      
      devices.push({
        deviceId: personalDevice,
        customerId: cid,
        deviceType: faker.helpers.arrayElement(['mobile', 'desktop', 'tablet']),
        os: faker.helpers.arrayElement(['iOS', 'Android', 'Windows', 'macOS']),
        browser: faker.helpers.arrayElement(['Chrome', 'Safari', 'Firefox', 'Edge'])
      });
      
      if (groupType === 'household' && i === 0) {
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
    const ts = rawLines.find(r => r.customerId === cid)?.timestamp || Date.now();
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

  const REASONS = ['damaged', 'wrong item', 'not as expected', 'quantity issue', 'delivery issue'];
  const NORMAL_COMPLAINT_TEMPLATES = [
    'Received my order but the delivery was several days late.',
    'The product does not perform as described.',
    'The package arrived with the box crushed.',
    'Order never reached my address.'
  ];

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
       complaints.push({
          complaintId: makeId('comp', complaints.length),
          customerId: meta.customerId,
          orderId: isAnyLinked ? bestTxnId.replace('txn_', 'ord_') : null,
          refundId,
          text: faker.helpers.arrayElement(NORMAL_COMPLAINT_TEMPLATES),
          category: 'refund',
          status: 'resolved',
          createdAt: ts.toISOString(),
        });
    }
  }

  finalTransactions.forEach(tx => delete tx._itemsRaw);
  
  return {
    customers, transactions: finalTransactions, refunds, complaints, devices,
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

  const { customerStats, rawLines, totalSourceRows, missingCustomerIdRows, outlierRows } = await loadAndProfileCSV(PROCESSED_CSV);
  if (totalSourceRows === 0) {
    console.error("No data found. Did you run the preprocessor?");
    process.exit(1);
  }

  const selectedCustomerIds = sampleCustomers(customerStats, TARGET_CUSTOMERS);
  const data = processData(rawLines, selectedCustomerIds, TARGET_CUSTOMERS);

  fs.writeFileSync(path.join(OUTPUT_DIR, 'customers.json'), JSON.stringify(data.customers, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'transactions.json'), JSON.stringify(data.transactions, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'refunds.json'), JSON.stringify(data.refunds, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'complaints.json'), JSON.stringify(data.complaints, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'devices.json'), JSON.stringify(data.devices, null, 2));
  
  const metadata = {
    source: "UCI Online Retail II",
    seed: SEED,
    currency: "GBP",
    customerCount: data.customers.length,
    transactionCount: data.transactions.length,
    refundCount: data.stats.totalRefunds,
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
    accountAgeSource: "synthetic_left_censoring",
    refundDerivation: "cancellation_invoice",
    linkingMethod: "Deterministic heuristic (same customer, prior, same StockCode, sufficient original quantity)",
    excludedCodes: Array.from(EXCLUDED_CODES),
    negativeNonCRows: "Ignored during parsing",
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
