import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createDemoCatalogScript } from '../src/demo-catalog';

const demoRoot = path.resolve(__dirname, '..');
const publicDir = path.join(demoRoot, 'public');
const outputDir = path.join(demoRoot, 'dist/hosted-preview');

async function main(): Promise<void> {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(publicDir, outputDir, { recursive: true });

  await writeFile(
    path.join(outputDir, 'config.js'),
    `window.OB_DEMO_CONFIG = ${JSON.stringify({
      hostedPreview: true,
      apiBaseUrl: '',
      publishableKey: '',
    })};\n`,
  );
  await writeFile(path.join(outputDir, 'demo-data.js'), createDemoCatalogScript());

  console.log(`Hosted Medusa preview written to ${outputDir}`);
}

void main();
