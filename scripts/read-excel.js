const XLSX = require('xlsx');
const path = 'C:\\Users\\Administrator\\Desktop\\200个.xlsx';

const wb = XLSX.readFile(path);
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, {header: 1});

console.log('Total rows:', data.length);
console.log('Headers:', JSON.stringify(data[0]));
console.log('Sample row 1:', JSON.stringify(data[1]));
console.log('Sample row 2:', JSON.stringify(data[2]));
