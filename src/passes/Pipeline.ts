import type { GlContext } from '../gl/GlContext.ts';
import { FeedPass } from './FeedPass.ts';
import type { FrameState, Mode, RenderPass } from './Pass.ts';
import { PersonPass } from './PersonPass.ts';
import { PresentPass } from './PresentPass.ts';
import { BackgroundPass } from './BackgroundPass.ts';
import { FlamesPass } from './FlamesPass.ts';
import { MaskBlurPass } from './MaskBlurPass.ts';
import { ParticleCompositePass } from './ParticleCompositePass.ts';
import { ParticlePass } from './ParticlePass.ts';
import { TitleCardPass } from './TitleCardPass.ts';
import { ShatterPass } from './ShatterPass.ts';
import { generateWedges } from '../shatter/wedges.ts';

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
  private readonly particles: ParticlePass;
  private readonly shatter: ShatterPass;

  /** Generates a fresh wedge layout for a new transition. */
  beginShatter(seed: number): void {
    this.shatter.setWedges(generateWedges(seed));
  }

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
    // Particles render into their own Three target, so they run first; the
    // composite blends them over the monster target right after Person.
    const particles = new ParticlePass();
    const particleComposite = new ParticleCompositePass(particles);
    this.particles = particles;
    // Title card draws over the monster target only while a burst is active.
    const titleCard = new TitleCardPass();
    // Transitioning: Monster passes (no present) render into targets.monster,
    // the feed renders into targets.normal, and the shatter pass composites both.
    const transFeed = new FeedPass((f) => f.targets.normal);
    const shatter = new ShatterPass();
    this.shatter = shatter;

    this.normal = [normalFeed];
    this.monster = [
      particles,
      maskBlur,
      background,
      flames,
      monsterPerson,
      particleComposite,
      titleCard,
      present,
    ];
    this.transitioning = [
      particles,
      maskBlur,
      background,
      flames,
      monsterPerson,
      particleComposite,
      titleCard,
      transFeed,
      shatter,
    ];
    this.all = [
      shatter,
      normalFeed,
      particles,
      maskBlur,
      background,
      flames,
      monsterPerson,
      particleComposite,
      titleCard,
      present,
      transFeed,
    ];
  }

  /** Burst_Start: respawn particles at the normalized Person_Center and show them. */
  startParticles(center: { x: number; y: number }): void {
    this.particles.reset(center);
    this.particles.show();
  }

  /** Return to Normal: hide and reset while keeping GPU resources. */
  stopParticles(): void {
    this.particles.hide();
    this.particles.reset({ x: 0.5, y: 0.5 });
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
