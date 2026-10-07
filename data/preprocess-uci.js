const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const RAW_FILE = path.join(__dirname, 'raw', 'online_retail_II.xlsx');
const PROCESSED_DIR = path.join(__dirname, 'processed');
const OUT_FILE = path.join(PROCESSED_DIR, 'online-retail-ii.csv');

if (!fs.existsSync(PROCESSED_DIR)) {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

console.log(`Reading dataset from ${RAW_FILE}...`);
const workbook = XLSX.readFile(RAW_FILE, { cellDates: true });

const writeStream = fs.createWriteStream(OUT_FILE);

// Write CSV header
writeStream.write('Invoice,StockCode,Description,Quantity,InvoiceDate,Price,Customer ID,Country\n');

const escapeCSV = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

let totalRows = 0;

workbook.SheetNames.forEach(sheetName => {
  console.log(`Parsing sheet: ${sheetName}`);
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  
  for (const row of rows) {
    const invoice = row['Invoice'] !== undefined ? row['Invoice'] : row['InvoiceNo'];
    const stockCode = row['StockCode'];
    const description = row['Description'];
    const quantity = row['Quantity'];
    let invoiceDate = row['InvoiceDate'];
    if (invoiceDate instanceof Date) {
      invoiceDate = invoiceDate.toISOString();
    }
    const price = row['Price'] !== undefined ? row['Price'] : row['UnitPrice'];
    const customerId = row['Customer ID'] !== undefined ? row['Customer ID'] : row['CustomerID'];
    const country = row['Country'];

    const line = [invoice, stockCode, description, quantity, invoiceDate, price, customerId, country]
      .map(escapeCSV)
      .join(',');
    
    writeStream.write(line + '\n');
    totalRows++;
  }
});

writeStream.end(() => {
  console.log(`Successfully wrote ${totalRows} rows to ${OUT_FILE}`);
});
