// Fill citizens + merrick + coversheet from the mock record and write PDFs.
import fs from "node:fs";
import { normalizeRecord } from "../lib/extract.js";
import { fillForm, buildPacket } from "../lib/fillForm.js";

process.env.TRANSCRIBE_MOCK = "1";
const { extractFromImages } = await import("../lib/extract.js");
const record = await extractFromImages([{ data: "x", mediaType: "image/png" }]);

const outDir = process.argv[2] || "/tmp/claude-0/-home-user-appupload/c0b67aaa-9174-5d7c-983b-6c815ec096e7/scratchpad/fill";
fs.mkdirSync(outDir, { recursive: true });

for (const form of ["citizens", "merrick", "coversheet"]) {
  const rec = form === "coversheet"
    ? { ...record, _date: "06/27/2026", _appLabel: "Application: Citizens Bank (Priority Payment Systems)", _bankShort: "Citizens" }
    : record;
  const bytes = await fillForm(form, rec);
  fs.writeFileSync(`${outDir}/${form}.pdf`, Buffer.from(bytes));
  console.log("wrote", `${outDir}/${form}.pdf`);
}

// Merrick variant of the record so we can preview that path too.
const merrickRec = normalizeRecord({ ...record, appType: "merrick" });
const packet = await buildPacket(merrickRec, { form: "merrick", date: "06/27/2026" });
fs.writeFileSync(`${outDir}/merrick-from-packet.pdf`, Buffer.from(packet.applicationPdf));
console.log("done");
