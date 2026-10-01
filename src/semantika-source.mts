import type {
  ContextBlock,
  ContextSource,
  ContextSourceRequest,
  ScoredContextBlock
} from './types.mjs';

export interface SemantikaArtifactLike {
  id: string;
}

export interface SemantikaTagLike {
  name: string;
  artifacts(options?: { includeDescendants?: boolean }): Promise<SemantikaArtifactLike[]>;
}

export interface SemantikaTagHit {
  tag: SemantikaTagLike;
  match: 'exact' | 'semantic';
  score?: number;
}

export interface SemantikaPackageLike {
  ready(): Promise<void>;
  tags: {
    search(query: string, options?: { limit?: number; minScore?: number }): Promise<SemantikaTagHit[]>;
  };
}

export interface SemantikaContextSourceOptions {
  semanticPackage: SemantikaPackageLike;
  toBlock: (artifact: SemantikaArtifactLike) => ContextBlock | null | Promise<ContextBlock | null>;
  tagLimit?: number;
  minTagScore?: number;
  includeDescendants?: boolean;
}

export class SemantikaContextSource implements ContextSource {
  private readonly sp: SemantikaPackageLike;
  private readonly toBlock: SemantikaContextSourceOptions['toBlock'];
  private readonly tagLimit: number;
  private readonly minTagScore?: number;
  private readonly includeDescendants: boolean;

  constructor(options: SemantikaContextSourceOptions) {
    this.sp = options.semanticPackage;
    this.toBlock = options.toBlock;
    this.tagLimit = options.tagLimit ?? 8;
    this.minTagScore = options.minTagScore;
    this.includeDescendants = options.includeDescendants ?? true;
  }

  async retrieve(request: ContextSourceRequest): Promise<ScoredContextBlock[]> {
    await this.sp.ready();

    const hits = await this.sp.tags.search(request.query, {
      limit: this.tagLimit,
      minScore: this.minTagScore
    });

    const candidates = new Map<string, {
      artifact: SemantikaArtifactLike;
      score: number;
      tags: string[];
      matches: string[];
    }>();

    for (const hit of hits) {
      const score = hit.match === 'exact' ? 1 : (hit.score ?? 0);
      const artifacts = await hit.tag.artifacts({ includeDescendants: this.includeDescendants });

      for (const artifact of artifacts) {
        const existing = candidates.get(artifact.id);
        if (!existing) {
          candidates.set(artifact.id, {
            artifact,
            score,
            tags: [hit.tag.name],
            matches: [hit.match]
          });
          continue;
        }

        existing.score = Math.max(existing.score, score);
        if (!existing.tags.includes(hit.tag.name)) existing.tags.push(hit.tag.name);
        if (!existing.matches.includes(hit.match)) existing.matches.push(hit.match);
      }
    }

    const ranked = [...candidates.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, request.limit);

    const result: ScoredContextBlock[] = [];
    for (const candidate of ranked) {
      const block = await this.toBlock(candidate.artifact);
      if (!block) continue;
      result.push({
        block,
        score: candidate.score,
        rationale: candidate.tags.map((tag, i) => `semantika:${candidate.matches[i] ?? candidate.matches[0]}:${tag}`)
      });
    }

    return result;
  }
}

export function createSemantikaSource(options: SemantikaContextSourceOptions): SemantikaContextSource {
  return new SemantikaContextSource(options);
}
