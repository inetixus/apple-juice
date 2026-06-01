"use client";

import Image, { type StaticImageData } from "next/image";
import dashboardImg from "@/icons/dashboard.png";
import ideImg from "@/icons/IDE.png";
import { SpineAnchor } from "./landing-spine";
import { GlassParallaxPanel } from "./glass-parallax-panel";

function CopyBlock({
  label,
  title,
  body,
}: {
  label?: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-[640px] mx-auto px-6 text-center">
      {label ? (
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#ccff00] mb-4">
          {label}
        </p>
      ) : null}
      <h3 className="text-xl md:text-2xl lg:text-[1.65rem] font-semibold text-white tracking-[-0.02em] leading-snug mb-4 md:mb-5">
        {title}
      </h3>
      <p className="text-base md:text-lg text-zinc-200 leading-relaxed font-normal">
        {body}
      </p>
    </div>
  );
}

function ProductFrame({ children }: { children: React.ReactNode }) {
  return (
    <GlassParallaxPanel className="w-full max-w-[1100px] mx-auto">
      <div className="liquid-glass-panel w-full rounded-2xl md:rounded-3xl border border-white/15 bg-white/[0.04] backdrop-blur-md overflow-hidden shadow-[0_32px_90px_rgba(0,0,0,0.45)]">
        {children}
      </div>
    </GlassParallaxPanel>
  );
}

function ProductImage({
  src,
  alt,
  priority = false,
}: {
  src: StaticImageData;
  alt: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={src.width}
      height={src.height}
      className="w-full h-auto block relative z-[1]"
      quality={90}
      sizes="(max-width: 1200px) 100vw, 1100px"
      priority={priority}
      placeholder="blur"
    />
  );
}

export function LandingWebIdeSection() {
  return (
    <div
      id="explore"
      className="py-24 md:py-36 lg:py-40 overflow-visible z-10 scroll-mt-24 px-6 md:px-12 relative"
    >
      <div
        className="absolute inset-x-0 top-0 h-[420px] pointer-events-none -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 100% 90% at 50% 0%, rgba(255,255,255,0.05), rgba(204,255,0,0.02) 35%, transparent 72%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 55% at 50% 100%, rgba(255,255,255,0.06), transparent 65%)",
        }}
      />

      <SpineAnchor id="intro" className="max-w-[640px] mx-auto text-center mb-20 md:mb-28 lg:mb-36">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#ccff00] mb-5">
          Apple Juice Web IDE
        </p>
        <h2 className="text-[2rem] sm:text-4xl md:text-[3.25rem] font-normal text-white leading-[1.12] tracking-[-0.02em]">
          Built for Roblox creators
          <span className="block text-zinc-300 mt-2 md:mt-3 text-xl sm:text-2xl md:text-[1.75rem] font-normal">
            in the agent-first era
          </span>
        </h2>
        <p className="mt-8 text-base md:text-lg text-zinc-200 leading-relaxed font-normal">
          A browser workspace for describing game mechanics, reviewing agent output,
          and syncing Luau into Studio—with the calm, product-first feel you expect
          from modern developer tools.
        </p>
      </SpineAnchor>

      <SpineAnchor id="workspace" className="space-y-10 md:space-y-14 mb-24 md:mb-32 lg:mb-40">
        <CopyBlock
          title="One place for every place file"
          body="Open a project, pick your model, and continue where you left off. The dashboard stays out of the way so you can move from idea to Studio session without hunting through tabs."
        />
        <ProductFrame>
          <ProductImage
            src={dashboardImg}
            alt="Apple Juice creator lobby with projects, juice tank, and quick prompts"
            priority
          />
        </ProductFrame>
      </SpineAnchor>

      <SpineAnchor id="projects" className="mb-24 md:mb-32 lg:mb-40">
        <CopyBlock
          label="Projects"
          title="Stay organized without a settings maze"
          body="Jump between experiences, keep chat history attached to each project, and choose the model that fits the task—whether that is fast iteration or heavier reasoning."
        />
      </SpineAnchor>

      <SpineAnchor id="editor" className="space-y-10 md:space-y-14">
        <CopyBlock
          label="Editor"
          title="Production-minded editing, not a toy demo"
          body="Syntax highlighting, file navigation, and pairing status live in the same view as the conversation—so you always know what the agent changed and what Studio will receive."
        />
        <ProductFrame>
          <ProductImage
            src={ideImg}
            alt="Apple Juice web IDE editor and agent chat"
          />
        </ProductFrame>
      </SpineAnchor>
    </div>
  );
}
