const XLSX = require('xlsx');
const path = 'C:\\Users\\Administrator\\Desktop\\200个.xlsx';

const wb = XLSX.readFile(path);
console.log('Sheet names:', wb.SheetNames);

const ws = wb.Sheets[wb.SheetNames[0]];

// Check all columns in first row
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
console.log('\nHeaders:', rows[0]);

// Check first data row - all columns
const dataRows = XLSX.utils.sheet_to_json(ws);
if (dataRows[0]) {
  console.log('\nFirst row all keys:', Object.keys(dataRows[0]));
  console.log('\nFirst row data:');
  for (const [key, value] of Object.entries(dataRows[0])) {
    if (value) console.log(`  ${key}: ${String(value).slice(0, 100)}`);
  }
}

// Check if there are any image-related properties
console.log('\nWorksheet keys:', Object.keys(ws).filter(k => k.includes('!')));
if (ws['!images']) console.log('Images:', ws['!images']);
if (ws['!drawings']) console.log('Drawings:', ws['!drawings']);
