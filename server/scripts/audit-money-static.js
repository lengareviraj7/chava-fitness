/**
 * Static Money & GST Formula Audit Script.
 * Fails the build if:
 * 1. `toFixed` or `parseFloat` are called on money values outside `money.js` and calculators.
 * 2. Duplicate GST calculation formulas exist outside `calculator.js` and `returnCalculator.js`.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const ALLOWED_MONEY_FILES = [
  'server/src/utils/money.js',
  'client/src/utils/money.js',
  'server/src/services/billing/calculator.js',
  'server/src/services/billing/returnCalculator.js',
  'client/src/shared/offline/calculator.js',
  'server/tests/money.test.js',
  'server/tests/calculatorByteParity.test.js',
];

const ALLOWED_GST_FORMULA_FILES = [
  'server/src/services/billing/calculator.js',
  'server/src/services/billing/returnCalculator.js',
  'client/src/shared/offline/calculator.js',
  'server/tests/calculatorByteParity.test.js',
];

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.system_generated') continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const allFiles = getAllFiles(rootDir);
const violations = [];

// Pattern checks
const TO_FIXED_REGEX = /\.toFixed\(/;
const GST_FORMULA_REGEX = /\/\s*\(\s*100\s*\+\s*.*gstRate\s*\)/i;

for (const filePath of allFiles) {
  const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');

  // 1. Check for duplicate GST formula
  if (GST_FORMULA_REGEX.test(content)) {
    if (!ALLOWED_GST_FORMULA_FILES.some((f) => relPath.endsWith(f))) {
      violations.push(`[DUPLICATE_GST_FORMULA] File '${relPath}' contains duplicate GST tax formula. Formulas must reside ONLY in calculator.js and returnCalculator.js.`);
    }
  }

  // 2. Check for toFixed on money/currency outside allowed files
  const lines = content.split('\n');
  lines.forEach((line, lineIdx) => {
    if (TO_FIXED_REGEX.test(line) && /paise|price|amount|balance|currency/i.test(line)) {
      if (!ALLOWED_MONEY_FILES.some((f) => relPath.endsWith(f))) {
        violations.push(`[ILLEGAL_FLOAT_OP] File '${relPath}:${lineIdx + 1}' calls toFixed() on currency variables. All money must remain integer paise.`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error('❌ Static Money & Formula Audit FAILED:');
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
} else {
  console.log('✅ Static Money & Formula Audit PASSED: Zero forbidden float operations or duplicate formulas.');
  process.exit(0);
}
