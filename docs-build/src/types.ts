export interface DocumentMetadata {
  title?: string;
  description?: string;
  date?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface CompileResult {
  code: string;
  metadata: DocumentMetadata;
  filename: string;
}

export interface CompilerOptions {
  inputDir: string;
  outputDir: string;
  watch?: boolean;
}

export interface FileManifest {
  sourceFile: string;
  outputFile: string;
  metadata: DocumentMetadata;
  sourceHash: string;
  size: number;
}

// Deliberately timestamp-free: the manifest is committed, so its content
// must be deterministic for identical sources.
export interface BuildManifest {
  files: FileManifest[];
  totalFiles: number;
}