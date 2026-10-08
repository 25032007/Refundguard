function makeId(prefix, n) {
  return `${prefix}_${String(n).padStart(5, '0')}`;
}

const COMPLAINT_TEMPLATES = {
  'damaged': [
    'The item arrived damaged and I would like a refund.',
    'The product was damaged when it arrived.',
    'I received the item with visible damage.',
    'The box was crushed and the item inside is broken.',
    'This arrived in pieces. Please refund.'
  ],
  'wrong item': [
    'I received the wrong item in my order.',
    'This is not what I ordered.',
    'You sent me the incorrect product.',
    'Wrong color and wrong size delivered.',
    'I ordered something else, please refund this wrong item.'
  ],
  'not as expected': [
    'The product does not perform as described.',
    'Quality is much lower than expected.',
    'The material feels cheap, not as expected.',
    'It doesn\'t look like the photos online.',
    'Very disappointed with the item quality.'
  ],
  'quantity issue': [
    'I ordered multiple but only received one.',
    'Missing parts from the package.',
    'The quantity delivered is incorrect.',
    'Short shipped. I did not get everything I paid for.',
    'Half the order is missing from the box.'
  ],
  'delivery issue': [
    'Received my order but the delivery was several days late.',
    'Order never reached my address.',
    'The delivery was delayed past the promised date.',
    'Tracking said delivered but it arrived a week later.',
    'Terrible shipping experience, very late.'
  ]
};

function injectScenario({ data, faker, calibration, scenarioId, family, memberCount, generateMembers, refDate }) {
  const cStartIndex = data.customers.length;
  
  const scenarioMembers = [];
  
  for (let i = 0; i < memberCount; i++) {
    // We use a somewhat randomized ID prefix or just continue the counter but padded.
    // It shouldn't scream "fraud". The original generator uses actual IDs from UCI or random.
    // UCI customer IDs are integers like 12345. Let's use 50000+ to avoid collisions with UCI (which are 12000-18000).
    const cid = String(50000 + cStartIndex + i);
    
    const cust = {
      customerId: cid,
      name: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      phone: faker.phone.number(),
      status: 'active',
      createdAt: faker.date.past({ years: 1, refDate }).toISOString()
    };
    
    data.customers.push(cust);
    scenarioMembers.push(cid);
    
    data.groundTruth.customers[cid] = {
      label: 'FRAUD',
      categories: [family],
      scenarioIds: [scenarioId],
      memberJoinDate: cust.createdAt
    };
  }
  
  data.groundTruth.scenarios.push({
    scenarioId,
    family,
    members: scenarioMembers
  });

  generateMembers(scenarioMembers, {
    data, 
    faker, 
    calibration,
    refDate,
    makeTxn: (cid, opts) => {
      const ts = opts.timestamp || faker.date.recent({ days: 100, refDate });
      const tx = {
        transactionId: makeId('txn', data.transactions.length + 100000), // ensure no collision
        customerId: cid,
        orderId: opts.orderId || makeId('ord', faker.number.int({ min: 100000, max: 999999 })),
        amount: opts.amount || calibration.sampleAmount(),
        currency: 'GBP',
        paymentMethod: opts.paymentMethod || faker.helpers.arrayElement(['card', 'wallet']),
        deviceId: opts.deviceId || makeId('dev', faker.string.alphanumeric(8)),
        ipAddress: opts.ipAddress || faker.internet.ipv4(),
        status: 'completed',
        createdAt: ts.toISOString()
      };
      data.transactions.push(tx);
      
      // ensure device exists
      if (!data.devices.some(d => d.deviceId === tx.deviceId)) {
        data.devices.push({
          deviceId: tx.deviceId,
          customerId: cid, // owner is arbitrarily the first user who creates it
          deviceType: faker.helpers.arrayElement(['mobile', 'desktop']),
          os: faker.helpers.arrayElement(['iOS', 'Android', 'Windows']),
          browser: faker.helpers.arrayElement(['Chrome', 'Safari'])
        });
      }
      
      return tx;
    },
    makeRefund: (tx, opts) => {
      const ts = opts.timestamp || new Date(new Date(tx.createdAt).getTime() + faker.number.int({ min: 86400000, max: 86400000 * 5 }));
      const reason = opts.reason || faker.helpers.arrayElement(Object.keys(COMPLAINT_TEMPLATES));
      const ref = {
        refundId: makeId('ref', data.refunds.length + 100000),
        transactionId: tx.transactionId,
        customerId: tx.customerId,
        orderId: tx.orderId,
        amount: tx.amount,
        reason,
        status: 'processed',
        requestedAt: ts.toISOString(),
        processedAt: ts.toISOString()
      };
      data.refunds.push(ref);
      
      if (opts.complaint) {
        data.complaints.push({
          complaintId: makeId('comp', data.complaints.length + 100000),
          customerId: tx.customerId,
          orderId: tx.orderId,
          refundId: ref.refundId,
          text: opts.complaintText || faker.helpers.arrayElement(COMPLAINT_TEMPLATES[reason]),
          category: 'refund',
          status: 'resolved',
          createdAt: ts.toISOString()
        });
      }
      return ref;
    }
  });
}

module.exports = { injectScenario, COMPLAINT_TEMPLATES };
