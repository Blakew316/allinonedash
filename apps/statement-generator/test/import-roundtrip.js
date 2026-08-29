#!/usr/bin/env node
/*
 * Round-trip check for the importer:
 *   node test/import-roundtrip.js <reference.pdf> <out-name>
 * Parses the reference with js/importer.js, regenerates a statement from the
 * parsed data, and writes test/out/<out-name>.pdf plus the parsed data as
 * test/out/<out-name>.json for inspection. Compare with test/compare.py /
 * compare2.py against the original.
 */
const fs = require('fs');
const path = require('path');

const pdfjsLib = require('../vendor/pdfjs.min.js');
pdfjsLib.GlobalWorkerOptions.workerSrc =
  path.join(__dirname, '..', 'vendor', 'pdfjs.worker.min.js');

const PDFLib = require('../vendor/pdf-lib.min.js');
const fontkit = require('../vendor/fontkit.umd.min.js');
const StatementPDF = require('../js/statement.js');
const StatementPDF2 = require('../js/statement2.js');
const StatementImport = require('../js/importer.js');

async function main() {
  const refPath = process.argv[2];
  const outName = process.argv[3] || 'roundtrip';
  const buffer = new Uint8Array(fs.readFileSync(refPath));

  const data = await StatementImport.parsePdf(buffer, pdfjsLib);

  const fontDir = path.join(__dirname, '..', 'fonts');
  let bytes;
  if (data.template === 'processing') {
    // the processing engine takes the style2 fields at the top level,
    // exactly as the app's dataForPdf() flattens them
    const flat = Object.assign({}, data.style2, {
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      batches: data.batches,
      template: 'processing'
    });
    bytes = await StatementPDF2.generate(flat, {
      pdfLib: PDFLib,
      fontkit,
      fonts: {
        sans: fs.readFileSync(path.join(fontDir, 'LiberationSans-Regular.ttf')),
        sansBold: fs.readFileSync(path.join(fontDir, 'LiberationSans-Bold.ttf')),
        sansBoldItalic: fs.readFileSync(path.join(fontDir, 'LiberationSans-BoldItalic.ttf'))
      },
      logo: null
    });
  } else {
    bytes = await StatementPDF.generate(data, {
      pdfLib: PDFLib,
      fontkit,
      fonts: {
        light: fs.readFileSync(path.join(fontDir, 'DejaVuSans-ExtraLight.ttf')),
        bold: fs.readFileSync(path.join(fontDir, 'DejaVuSans-Bold.ttf')),
        book: fs.readFileSync(path.join(fontDir, 'DejaVuSans.ttf'))
      },
      logo: null
    });
  }

  const outDir = path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${outName}.json`), JSON.stringify(data, null, 1));
  fs.writeFileSync(path.join(outDir, `${outName}.pdf`), bytes);
  console.log(`template: ${data.template} -> wrote test/out/${outName}.pdf (${bytes.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
