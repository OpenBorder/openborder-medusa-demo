import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const forbidden = [
  ['private package scope', /@openborder-mor\//g],
  ['workspace dependency', /workspace:\*/g],
  ['internal PAY ticket', /PAY-[0-9]+/g],
  ['internal staging hostname', /api-staging\.openborderpayments\.com/g],
  ['committed live secret', /sk_live_[A-Za-z0-9_-]{8,}/g],
  ['committed test secret', /sk_test_[A-Za-z0-9_-]{8,}/g],
  ['committed live publishable key', /pk_live_[A-Za-z0-9_-]{8,}/g],
];

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
  .filter((file) => !/\.(png|jpg|jpeg|gif|webp|ico)$/i.test(file));

const failures = [];
for (const file of files) {
  const contents = readFileSync(file, 'utf8');
  for (const [label, pattern] of forbidden) {
    pattern.lastIndex = 0;
    if (pattern.test(contents)) failures.push(`${file}: ${label}`);
  }
}

if (failures.length > 0) {
  console.error('Public-safety check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Public-safety check passed for ${files.length} text files.`);
