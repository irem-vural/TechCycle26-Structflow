const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { unzipSync, strFromU8 } = require('fflate');

const root = path.resolve('artifacts/archive/outputs');
const files = [];
for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const folder = path.join(root, dir.name);
  for (const file of fs.readdirSync(folder)) {
    if (/Karışım tablosu.*\.xlsx$/i.test(file)) files.push(path.join(folder, file));
  }
}

(async () => {
  for (const file of files) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.readFile(file);
      const sheet = workbook.worksheets[0];
      console.log(JSON.stringify({ file, sheets: workbook.worksheets.length, rows: sheet?.rowCount ?? 0, cols: sheet?.columnCount ?? 0 }));
    } catch (error) {
      const zip = unzipSync(fs.readFileSync(file));
      const entries = Object.keys(zip).sort();
      const workbookXml = zip['xl/workbook.xml'] ? strFromU8(zip['xl/workbook.xml']) : null;
      console.error(JSON.stringify({
        file,
        error: error instanceof Error ? error.message : String(error),
        entries,
        hasWorkbookXml: Boolean(workbookXml),
        workbookXmlPreview: workbookXml?.slice(0, 1000) ?? null,
      }));
    }
  }
})();
