const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

async function main() {
  const xlsxPath = 'C:\\Users\\user\\Downloads\\Muara Money Manager\\MONEY MANAGER.xlsx';
  const csvPath = 'C:\\Users\\user\\Downloads\\Muara Money Manager\\Blu BCA - Augustus.csv';

  console.log('--- INSPECTING CSV ---');
  if (fs.existsSync(csvPath)) {
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (line.includes('32771') || line.includes('32.771') || line.includes('05/08') || line.includes('5/8') || line.includes('2026-08-05')) {
        console.log(`CSV line ${idx + 1}: ${line}`);
      }
    });
  } else {
    console.log('CSV file not found at:', csvPath);
  }

  console.log('\n--- INSPECTING EXCEL ---');
  if (fs.existsSync(xlsxPath)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(xlsxPath);
    wb.worksheets.forEach((ws) => {
      console.log(`Sheet name: ${ws.name}, row count: ${ws.rowCount}`);
      ws.eachRow((row, rowNumber) => {
        const values = row.values;
        const rowStr = JSON.stringify(values);
        if (rowStr.includes('32771') || rowStr.includes('32.771')) {
          console.log(`Excel [${ws.name}] Row ${rowNumber}:`, JSON.stringify(values, null, 2));
        }
      });
    });
  } else {
    console.log('Excel file not found at:', xlsxPath);
  }
}

main().catch(console.error);
