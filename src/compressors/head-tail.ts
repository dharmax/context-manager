import type { ContextCompressorAdapter } from '../types.ts';

export interface HeadTailOptions {
  headLines?: number;
  tailLines?: number;
  charsPerToken?: number;
}

export class HeadTailCompressor implements ContextCompressorAdapter {
  name = 'head-tail';
  private headLines: number;
  private tailLines: number;
  private charsPerToken: number;

  constructor(options: HeadTailOptions = {}) {
    this.headLines = options.headLines ?? 15;
    this.tailLines = options.tailLines ?? 10;
    this.charsPerToken = options.charsPerToken ?? 3.7;
  }

  compress(text: string, maxTokens: number): string {
    if (!text) return '';

    const maxChars = Math.floor(maxTokens * this.charsPerToken);
    if (text.length <= maxChars) {
      return text;
    }

    const lines = text.split('\n');
    if (lines.length <= this.headLines + this.tailLines) {
      const half = Math.floor(maxChars / 2) - 20;
      if (half > 10) {
        return `${text.slice(0, half)}\n\n... [truncated] ...\n\n${text.slice(-half)}`;
      }
      return text.slice(0, maxChars);
    }

    let headCount = this.headLines;
    let tailCount = this.tailLines;

    let head = lines.slice(0, headCount).join('\n');
    let tail = lines.slice(-tailCount).join('\n');

    while (head.length + tail.length + 50 > maxChars && (headCount > 3 || tailCount > 2)) {
      if (headCount > 3) headCount--;
      if (tailCount > 2) tailCount--;
      head = lines.slice(0, headCount).join('\n');
      tail = lines.slice(-tailCount).join('\n');
    }

    const omitted = lines.length - (headCount + tailCount);
    return `${head}\n\n... [truncated ${omitted} lines] ...\n\n${tail}`;
  }
}
