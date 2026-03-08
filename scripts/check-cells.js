const XLSX = require('xlsx');
const path = 'C:\\Users\\Administrator\\Desktop\\200个.xlsx';

// Read with all options
const wb = XLSX.readFile(path, { cellStyles: true, cellHTML: true });
const ws = wb.Sheets[wb.SheetNames[0]];

// Check cell A2 (first image cell)
console.log('Cell A2:', ws['A2']);
console.log('Cell A3:', ws['A3']);

// Check for hyperlinks
if (ws['!hyperlinks']) {
  console.log('\nHyperlinks:', ws['!hyperlinks']);
}

// Check raw cell range
const range = XLSX.utils.decode_range(ws['!ref']);
console.log('\nRange:', range);

// Check column A cells
for (let r = 1; r <= 5; r++) {
  const cell = ws[XLSX.utils.encode_cell({r: r, c: 0})];
  if (cell) {
    console.log(`\nCell A${r+1}:`, JSON.stringify(cell));
  }
}
