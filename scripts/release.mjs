#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
const newVersion = `${major}.${minor}.${patch + 1}`;

console.log(`Bumping ${pkg.version} → ${newVersion}`);
pkg.version = newVersion;
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

execSync('git add package.json');
execSync(`git commit -m "chore: release v${newVersion}"`);
execSync(`git tag v${newVersion}`);

console.log(`\nTagged v${newVersion}.`);
console.log('Run: git push --follow-tags && npm publish');
