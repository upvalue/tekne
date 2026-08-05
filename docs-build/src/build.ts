#!/usr/bin/env tsx
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { processFile } from './compiler.ts';
import type { CompilerOptions, BuildManifest } from './types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function findMdxFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await findMdxFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  return files;
}

async function buildAll(options: CompilerOptions): Promise<void> {
  console.log('🚀 Starting docs build...\n');
  
  const startTime = Date.now();
  
  try {
    await fs.mkdir(options.outputDir, { recursive: true });
    
    const files = await findMdxFiles(options.inputDir);
    
    if (files.length === 0) {
      console.log('No MD/MDX files found in', options.inputDir);
      return;
    }
    
    console.log(`Found ${files.length} file(s) to process:\n`);
    
    const fileManifests = [];
    
    for (const file of files) {
      try {
        const manifest = await processFile(file, options.outputDir);
        fileManifests.push(manifest);
      } catch (error) {
        console.error(`✗ Error processing ${path.basename(file)}:`, error);
      }
    }
    
    await generateIndex(options.outputDir, files.map(f => 
      path.basename(f, path.extname(f))
    ));
    
    // Generate build manifest
    const buildDuration = Date.now() - startTime;
    const buildManifest: BuildManifest = {
      files: fileManifests,
      totalFiles: fileManifests.length
    };
    
    await generateManifest(options.outputDir, buildManifest);
    
    const elapsed = (buildDuration / 1000).toFixed(2);
    console.log(`\n✅ Build completed in ${elapsed}s`);
    
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

async function generateIndex(outputDir: string, filenames: string[]): Promise<void> {
  const imports = filenames.map((name, i) => {
    const componentName = toPascalCase(name);
    return `export { default as ${componentName}, metadata as ${componentName}Metadata } from './${name}.tsx';`;
  }).join('\n');
  
  const indexPath = path.join(outputDir, 'index.ts');
  await fs.writeFile(indexPath, imports + '\n', 'utf-8');
  console.log('\n✓ Generated index.ts');
}

async function generateManifest(outputDir: string, manifest: BuildManifest): Promise<void> {
  const manifestPath = path.join(outputDir, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log('✓ Generated manifest.json');
}

async function updateSingleFile(filePath: string, options: CompilerOptions): Promise<void> {
  await processFile(filePath, options.outputDir);
  
  // Regenerate index and manifest after single file update
  const files = await findMdxFiles(options.inputDir);
  await generateIndex(options.outputDir, files.map(f => 
    path.basename(f, path.extname(f))
  ));
  
  // Regenerate full manifest
  const fileManifests = [];
  for (const file of files) {
    try {
      const manifest = await processFile(file, options.outputDir);
      fileManifests.push(manifest);
    } catch (error) {
      console.error(`✗ Error processing ${path.basename(file)} for manifest:`, error);
    }
  }
  
  const buildManifest: BuildManifest = {
    files: fileManifests,
    totalFiles: fileManifests.length
  };

  await generateManifest(options.outputDir, buildManifest);
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

async function watch(options: CompilerOptions): Promise<void> {
  const { default: chokidar } = await import('chokidar');
  
  console.log('👁️  Watching for changes...\n');
  
  await buildAll(options);
  
  const watcher = chokidar.watch(['**/*.md', '**/*.mdx'], {
    cwd: options.inputDir,
    ignored: ['node_modules/**', '.git/**'],
    persistent: true,
    ignoreInitial: true
  });
  
  watcher.on('change', async (filepath) => {
    console.log(`\n📝 File changed: ${filepath}`);
    const fullPath = path.join(options.inputDir, filepath);
    try {
      await updateSingleFile(fullPath, options);
    } catch (error) {
      console.error(`✗ Error processing ${filepath}:`, error);
    }
  });
  
  watcher.on('add', async (filepath) => {
    console.log(`\n➕ File added: ${filepath}`);
    const fullPath = path.join(options.inputDir, filepath);
    try {
      await updateSingleFile(fullPath, options);
    } catch (error) {
      console.error(`✗ Error processing ${filepath}:`, error);
    }
  });
  
  console.log('Press Ctrl+C to stop watching\n');
}

async function main(): Promise<void> {
  const projectRoot = path.resolve(__dirname, '../..');
  const inputDir = path.join(projectRoot, 'docs');
  const outputDir = path.join(__dirname, '..', 'generated');
  
  const options: CompilerOptions = {
    inputDir,
    outputDir,
    watch: process.argv.includes('--watch')
  };
  
  console.log('📁 Input directory:', inputDir);
  console.log('📂 Output directory:', outputDir);
  console.log();
  
  if (options.watch) {
    await watch(options);
  } else {
    await buildAll(options);
  }
}

main().catch(console.error);