import type { GlContext } from '../gl/GlContext.ts';
import { FeedPass } from './FeedPass.ts';
import type { FrameState, Mode, RenderPass } from './Pass.ts';
import { PresentPass } from './PresentPass.ts';

/**
 * Holds three fixed ordered pass lists. Passes in the Monster list that
 * write into targets.monster are followed by PresentPass.
 */
export class Pipeline {
  readonly normal: RenderPass[];
  readonly monster: RenderPass[];
  readonly transitioning: RenderPass[];
  private readonly all: RenderPass[];

  constructor() {
    // Normal: feed straight to the default framebuffer.
    const normalFeed = new FeedPass(() => null);
    // Monster (Phase 1): feed into the monster target, then present it.
    const monsterFeed = new FeedPass((f) => f.targets.monster);
    const present = new PresentPass();
    // Transitioning (Phase 1 placeholder): same as Monster without present.
    const transFeed = new FeedPass((f) => f.targets.monster);

    this.normal = [normalFeed];
    this.monster = [monsterFeed, present];
    this.transitioning = [transFeed];
    this.all = [normalFeed, monsterFeed, present, transFeed];
  }

  init(ctx: GlContext): void {
    for (const p of this.all) p.init(ctx);
  }

  listFor(mode: Mode): RenderPass[] {
    if (mode === 'monster') return this.monster;
    if (mode === 'transitioning') return this.transitioning;
    return this.normal;
  }

  render(frame: FrameState): void {
    for (const p of this.listFor(frame.mode)) {
      if (p.enabled(frame)) p.render(frame);
    }
  }

  resize(w: number, h: number): void {
    for (const p of this.all) p.resize(w, h);
  }

  dispose(): void {
    for (const p of this.all) p.dispose();
  }
}
