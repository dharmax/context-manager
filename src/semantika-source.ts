import type {
  ContextBlock,
  ContextSource,
  ContextSourceRequest,
  ScoredContextBlock
} from './types.ts';

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
  ready(): Promise<unknown>;
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
    if (request.limit <= 0) return [];
    await this.sp.ready();

    const hits = await this.sp.tags.search(request.query, {
      limit: this.tagLimit,
      minScore: this.minTagScore
    });

    const candidates = new Map<string, {
      artifact: SemantikaArtifactLike;
      score: number;
      tags: string[];
      reasons: string[];
    }>();

    const discovered = await Promise.all(hits.map(async hit => ({
      hit,
      artifacts: await hit.tag.artifacts({ includeDescendants: this.includeDescendants })
    })));

    for (const { hit, artifacts } of discovered) {
      const score = hit.match === 'exact' ? 1 : (hit.score ?? 0);
      for (const artifact of artifacts) {
        const existing = candidates.get(artifact.id);
        if (!existing) {
          candidates.set(artifact.id, {
            artifact,
            score,
            tags: [hit.tag.name],
            reasons: [`semantika:${hit.match}:${hit.tag.name}`]
          });
          continue;
        }

        existing.score = Math.max(existing.score, score);
        if (!existing.tags.includes(hit.tag.name)) {
          existing.tags.push(hit.tag.name);
          existing.reasons.push(`semantika:${hit.match}:${hit.tag.name}`);
        }
      }
    }

    const ranked = [...candidates.values()].sort((a, b) => b.score - a.score);

    const result: ScoredContextBlock[] = [];
    for (const candidate of ranked) {
      const block = await this.toBlock(candidate.artifact);
      if (!block) continue;
      result.push({
        block,
        score: candidate.score,
        rationale: candidate.reasons
      });
      if (result.length >= request.limit) break;
    }

    return result;
  }
}

export function createSemantikaSource(options: SemantikaContextSourceOptions): SemantikaContextSource {
  return new SemantikaContextSource(options);
}
