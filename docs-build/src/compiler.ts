import { compile } from '@mdx-js/mdx'
import matter from 'gray-matter'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import type { CompileResult, DocumentMetadata, FileManifest } from './types.ts'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'

export async function compileMdxToTsx(
  filepath: string,
  content: string
): Promise<CompileResult> {
  const { data: frontmatter, content: mdxContent } = matter(content)

  const filename = path.basename(filepath, path.extname(filepath))

  const compiled = await compile(mdxContent, {
    jsx: true,
    jsxRuntime: 'automatic',
    outputFormat: 'program',
    remarkPlugins: [remarkGfm, remarkFrontmatter],
    development: false,
  })

  const componentName = toPascalCase(filename)

  const tsxCode = generateTsxComponent(
    componentName,
    compiled.value.toString(),
    frontmatter as DocumentMetadata
  )

  return {
    code: tsxCode,
    metadata: frontmatter as DocumentMetadata,
    filename,
  }
}

function generateTsxComponent(
  componentName: string,
  compiledMdx: string,
  metadata: DocumentMetadata
): string {
  const metadataExport = JSON.stringify(metadata, null, 2)

  // Clean up the compiled MDX and extract the default export
  const cleanedMdx = compiledMdx
    .replace(/import.*from ['"]react\/jsx-runtime['"];?\n?/g, '')
    .replace(/\/\*@jsxRuntime automatic\*\/\n?/g, '')
    .replace(/\/\*@jsxImportSource react\*\/\n?/g, '')
    .replace(/"use strict";\n?/g, '')
    .replace(/export default function MDXContent/, `function ${componentName}`)
    .replace(/export default MDXContent;?/, '')
    .replace(
      /function _createMdxContent\(props\)/,
      `function _createMdxContent(props: any)`
    )
    .replace(
      new RegExp(`function ${componentName}\\(props = \\{\\}\\)`),
      `function ${componentName}(props: ${componentName}Props = {})`
    )
    .replace(/props\.components/g, `(props.components || {})`)
    .replace(
      /\(props\.components \|\| \{\}\) \|\| \(\{\}\)/g,
      `(props.components || {})`
    )

  return `/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';
import { ExternalLink } from '@/components/ExternalLink';

export const metadata = ${metadataExport};

export interface ${componentName}Props {
  components?: Record<string, React.ComponentType<any>>;
  [key: string]: any;
}

${cleanedMdx}

export default function ${componentName}Wrapper(props: ${componentName}Props = {}) {
  const customComponents = {
    a: ({ href, children, ...rest }: any) => {
      // Check if it's an external link
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        return <ExternalLink href={href} {...rest}>{children}</ExternalLink>;
      }
      // Internal links use regular anchor
      return <a href={href} {...rest}>{children}</a>;
    },
    ...props.components
  };
  
  return <${componentName} {...props} components={customComponents} />;
}
`
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

export async function processFile(
  inputPath: string,
  outputDir: string
): Promise<FileManifest> {
  const buildStart = Date.now()
  const content = await fs.readFile(inputPath, 'utf-8')
  const stats = await fs.stat(inputPath)
  const result = await compileMdxToTsx(inputPath, content)

  const outputFilename = `${result.filename}.tsx`
  const outputPath = path.join(outputDir, outputFilename)

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(outputPath, result.code, 'utf-8')

  // Generate hash for the source content
  const sourceHash = createHash('sha256').update(content).digest('hex')

  const manifest: FileManifest = {
    sourceFile: path.relative(process.cwd(), inputPath),
    outputFile: path.relative(process.cwd(), outputPath),
    metadata: result.metadata,
    sourceHash,
    buildTimestamp: buildStart,
    lastModified: stats.mtime.getTime(),
    size: stats.size,
  }

  console.log(`✓ Compiled ${path.basename(inputPath)} → ${outputFilename}`)
  return manifest
}
