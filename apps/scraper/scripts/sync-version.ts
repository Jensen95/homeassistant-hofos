#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

interface PackageJson {
  version: string;
  [key: string]: unknown;
}

try {
  const packageJsonPath = join(rootDir, 'package.json');
  const packageJson: PackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const version = packageJson.version;

  console.log(`Found version ${version} in package.json`);

  const configYamlPath = join(rootDir, 'config.yaml');
  const configYaml = readFileSync(configYamlPath, 'utf-8');

  const updatedConfigYaml = configYaml.replace(
    /^version:\s*['"]?[\d.]+['"]?$/m,
    `version: '${version}'`
  );

  writeFileSync(configYamlPath, updatedConfigYaml, 'utf-8');

  console.log(`✅ Updated config.yaml to version ${version}`);
  process.exit(0);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error('❌ Error syncing version:', errorMessage);
  process.exit(1);
}
