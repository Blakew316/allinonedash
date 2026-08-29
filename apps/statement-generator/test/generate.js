#!/usr/bin/env node
/*
 * Headless generator used to verify the layout engine against the
 * reference statements:  node test/generate.js <dataset> [logo.png]
 * Writes test/out/<dataset>.pdf
 */
const fs = require('fs');
const path = require('path');

const PDFLib = require('../vendor/pdf-lib.min.js');
const fontkit = require('../vendor/fontkit.umd.min.js');
const StatementPDF = require('../js/statement.js');
const StatementPDF2 = require('../js/statement2.js');
const StatementBank = require('../js/statement3.js');

async function main() {
  const name = process.argv[2] || 'april';
  const dataPath = path.join(__dirname, 'data', `${name}.json`);
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  const fontDir = path.join(__dirname, '..', 'fonts');

  const logoPath = process.argv[3];
  const logo = logoPath
    ? {
        bytes: fs.readFileSync(logoPath),
        mime: /\.jpe?g$/i.test(logoPath) ? 'image/jpeg' : 'image/png'
      }
    : null;

  let bytes;
  if (data.template === 'bank') {
    bytes = await StatementBank.generate(data, {
      pdfLib: PDFLib,
      fontkit,
      fonts: {
        sans: fs.readFileSync(path.join(fontDir, 'LiberationSans-Regular.ttf')),
        sansBold: fs.readFileSync(path.join(fontDir, 'LiberationSans-Bold.ttf'))
      },
      logo: null
    });
  } else if (data.template === 'processing') {
    bytes = await StatementPDF2.generate(data, {
      pdfLib: PDFLib,
      fontkit,
      fonts: {
        sans: fs.readFileSync(path.join(fontDir, 'LiberationSans-Regular.ttf')),
        sansBold: fs.readFileSync(path.join(fontDir, 'LiberationSans-Bold.ttf')),
        sansBoldItalic: fs.readFileSync(path.join(fontDir, 'LiberationSans-BoldItalic.ttf'))
      },
      logo
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
      logo
    });
  }

  const outDir = path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${name}.pdf`);
  fs.writeFileSync(outPath, bytes);
  console.log(`wrote ${outPath} (${bytes.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
