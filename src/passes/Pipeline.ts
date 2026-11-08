import type { GlContext } from '../gl/GlContext.ts';
import { FeedPass } from './FeedPass.ts';
import type { FrameState, Mode, RenderPass } from './Pass.ts';
import { PersonPass } from './PersonPass.ts';
import { PresentPass } from './PresentPass.ts';
import { BackgroundPass } from './BackgroundPass.ts';
import { FlamesPass } from './FlamesPass.ts';
import { MaskBlurPass } from './MaskBlurPass.ts';

/**
 * Holds three fixed ordered pass lists. Passes in the Monster list that
 * write into targets.monster are followed by PresentPass.
 */
export class Pipeline {
  readonly normal: RenderPass[];
  readonly monster: RenderPass[];
  readonly transitioning: RenderPass[];
  private readonly all: RenderPass[];
  private readonly background: BackgroundPass;

  /** Sets the smoothed Person_Center used by the background light rays. */
  setBackgroundCenter(x: number, y: number): void {
    this.background.setCenter(x, y);
  }

  constructor() {
    // Normal: feed straight to the default framebuffer.
    const normalFeed = new FeedPass(() => null);
    // Monster (Phase 1): feed into the monster target, then present it.
    // Phase 3: BackgroundPass draws an opaque halftone base, so the solid
    // #2A0845 base is no longer needed in the Monster list.
    const maskBlur = new MaskBlurPass();
    const background = new BackgroundPass((f) => f.targets.monster);
    const flames = new FlamesPass(
      (f) => f.targets.monster,
      () => maskBlur.outputTexture,
    );
    this.background = background;
    const monsterPerson = new PersonPass((f) => f.targets.monster);
    const present = new PresentPass();
    // Transitioning (Phase 1 placeholder): same as Monster without present.
    const transFeed = new FeedPass((f) => f.targets.monster);

    this.normal = [normalFeed];
    this.monster = [maskBlur, background, flames, monsterPerson, present];
    this.transitioning = [transFeed];
    this.all = [normalFeed, maskBlur, background, flames, monsterPerson, present, transFeed];
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
