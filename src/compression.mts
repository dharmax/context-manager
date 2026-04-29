import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class LeanContextCompressor {
  static compress(text: string, maxWords: number = 300): string {
    if (!text) return '';

    const normalized = text
      .replace(/as an AI language model/gi, '')
      .replace(/I am an AI assistant/gi, '')
      .replace(/In this context/gi, '')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    const words = normalized.split(/\s+/);
    if (words.length <= maxWords) return normalized;
    return `${words.slice(0, maxWords).join(' ')}\n... [compressed]`;
  }

  static async patternCompress(text: string, maxWords: number = 300): Promise<string> {
    if (!text) return '';

    try {
      const { stdout } = await execFileAsync('lean-ctx', ['-c', text], {
        maxBuffer: 1024 * 1024
      });
      const compressed = stdout.trim();
      return compressed || this.compress(text, maxWords);
    } catch {
      return this.compress(text, maxWords);
    }
  }
}
