import type { ContextCompressorAdapter } from '../types.mjs';
import { HeadTailCompressor } from './head-tail.mjs';

export interface CodeOutlineOptions {
  charsPerToken?: number;
}

export class CodeOutlineCompressor implements ContextCompressorAdapter {
  name = 'code-outline';
  private fallback: HeadTailCompressor;
  private charsPerToken: number;

  constructor(options: CodeOutlineOptions = {}) {
    this.fallback = new HeadTailCompressor();
    this.charsPerToken = options.charsPerToken ?? 3.7;
  }

  compress(code: string, maxTokens: number): string {
    if (!code) return '';
    const maxChars = Math.floor(maxTokens * this.charsPerToken);
    if (code.length <= maxChars) {
      return code;
    }

    const lines = code.split('\n');
    const outlineLines: string[] = [];
    let insideDocBlock = false;
    let insideTypeDef = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Preserve JSDoc
      if (trimmed.startsWith('/**') || trimmed.startsWith('/*')) {
        insideDocBlock = true;
        outlineLines.push(line);
        if (trimmed.endsWith('*/')) insideDocBlock = false;
        continue;
      }
      if (insideDocBlock) {
        outlineLines.push(line);
        if (trimmed.endsWith('*/')) insideDocBlock = false;
        continue;
      }

      // Preserve single line comments if concise
      if (trimmed.startsWith('//') && trimmed.length < 80) {
        outlineLines.push(line);
        continue;
      }

      // Preserve imports
      if (trimmed.startsWith('import ')) {
        outlineLines.push(line);
        continue;
      }

      // Preserve Type / Interface definitions completely
      if (
        trimmed.startsWith('export interface ') ||
        trimmed.startsWith('interface ') ||
        trimmed.startsWith('export type ') ||
        trimmed.startsWith('type ')
      ) {
        insideTypeDef = true;
        outlineLines.push(line);
        if (trimmed.endsWith(';') || (trimmed.includes('}') && !trimmed.includes('{'))) {
          insideTypeDef = false;
        }
        continue;
      }

      if (insideTypeDef) {
        outlineLines.push(line);
        if (trimmed === '}' || trimmed === '};' || trimmed.endsWith(';')) {
          insideTypeDef = false;
        }
        continue;
      }

      // Function / Method / Class signatures
      if (
        trimmed.startsWith('export class ') ||
        trimmed.startsWith('class ') ||
        trimmed.startsWith('export function ') ||
        trimmed.startsWith('export async function ') ||
        trimmed.startsWith('function ') ||
        trimmed.startsWith('async function ') ||
        /^(public|private|protected|static|async|\s*get|\s*set|\w+\s*\()/.test(trimmed)
      ) {
        if (trimmed.endsWith('{')) {
          // Class or function with inline open brace
          if (trimmed.startsWith('class ') || trimmed.startsWith('export class ')) {
            outlineLines.push(line);
          } else {
            outlineLines.push(line.replace(/\{$/, '{ /* ... */ }'));
          }
        } else if (trimmed.endsWith(';')) {
          outlineLines.push(line);
        } else {
          outlineLines.push(line);
        }
        continue;
      }

      // Class closing brace
      if (trimmed === '}' || trimmed === '};') {
        outlineLines.push(line);
      }
    }

    const outline = outlineLines.join('\n');
    if (outline.length > 0 && outline.length <= maxChars) {
      return outline;
    }

    return this.fallback.compress(code, maxTokens);
  }
}
