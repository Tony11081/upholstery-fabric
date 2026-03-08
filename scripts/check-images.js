const XLSX = require('xlsx');
const path = 'C:\\Users\\Administrator\\Desktop\\200个.xlsx';

const wb = XLSX.readFile(path);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws);

// Check first 3 rows for image data
const samples = rows.slice(0, 3);
samples.forEach((row, i) => {
  console.log(`\n=== Row ${i + 1} ===`);
  console.log('图片:', row['商品图片']);
  console.log('描述:', row['商品名称/描述']?.slice(0, 30));
});
