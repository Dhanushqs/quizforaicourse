// Turn rows into CSV text that opens correctly in Excel.

// A cell starting with = + - @ could be run as a formula by Excel ("CSV injection").
// We neutralise it by adding a leading apostrophe.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (FORMULA_START.test(text)) text = "'" + text;
  if (/[",\n\r]/.test(text)) text = '"' + text.replace(/"/g, '""') + '"';
  return text;
}

export function toCsv(headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  // The leading BOM makes Excel read the file as UTF-8 (so non-English names look right).
  return "﻿" + lines.join("\r\n");
}
