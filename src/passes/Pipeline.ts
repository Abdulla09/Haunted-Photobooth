import type { GlContext } from '../gl/GlContext.ts';
import { FeedPass } from './FeedPass.ts';
import type { FrameState, Mode, RenderPass } from './Pass.ts';
import { PersonPass } from './PersonPass.ts';
import { PresentPass } from './PresentPass.ts';
import { SolidBasePass } from './SolidBasePass.ts';
import { PALETTE_VEC3 } from '../app/palette.ts';

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
    const monsterBase = new SolidBasePass((f) => f.targets.monster, PALETTE_VEC3.deepPurple);
    const monsterPerson = new PersonPass((f) => f.targets.monster);
    const present = new PresentPass();
    // Transitioning (Phase 1 placeholder): same as Monster without present.
    const transFeed = new FeedPass((f) => f.targets.monster);

    this.normal = [normalFeed];
    this.monster = [monsterBase, monsterPerson, present];
    this.transitioning = [transFeed];
    this.all = [normalFeed, monsterBase, monsterPerson, present, transFeed];
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
