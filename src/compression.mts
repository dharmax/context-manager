import { HeadTailCompressor } from './compressors/head-tail.mjs';
import { CodeOutlineCompressor } from './compressors/code-outline.mjs';

export { HeadTailCompressor, CodeOutlineCompressor };

export class LeanContextCompressor {
  private static headTail = new HeadTailCompressor();

  static compress(text: string, maxWords: number = 300): string {
    if (!text) return '';
    const approxTokens = Math.floor(maxWords * 1.3);
    return this.headTail.compress(text, approxTokens);
  }

  static async patternCompress(text: string, maxWords: number = 300): Promise<string> {
    return this.compress(text, maxWords);
  }
}
