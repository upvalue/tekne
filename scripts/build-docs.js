#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function buildDocs() {
  console.log('🚀 Building documentation...\n');
  
  try {
    // Step 1: Run docs-build to compile MDX files
    console.log('📝 Compiling MDX files...');
    process.chdir(path.join(projectRoot, 'docs-build'));
    execSync('pnpm build', { stdio: 'inherit' });
    
    // Step 2: Create src/docs directory
    const srcDocsDir = path.join(projectRoot, 'src', 'documentation');
    console.log('\n📁 Creating src/documentation directory...');
    await fs.mkdir(srcDocsDir, { recursive: true });
    
    // Step 3: Copy generated files to src/docs
    const generatedDir = path.join(projectRoot, 'docs-build', 'generated');
    console.log('📋 Copying generated files to src/documentation...');
    
    const files = await fs.readdir(generatedDir);
    for (const file of files) {
      const srcPath = path.join(generatedDir, file);
      const destPath = path.join(srcDocsDir, file);
      await fs.copyFile(srcPath, destPath);
      console.log(`  ✓ Copied ${file}`);
    }
    
    console.log('\n✅ Documentation build complete!');
    console.log(`📁 Generated files are now available in src/documentation/`);
    
  } catch (error) {
    console.error('❌ Documentation build failed:', error);
    process.exit(1);
  }
}

buildDocs();
