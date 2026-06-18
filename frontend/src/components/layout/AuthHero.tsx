import type { ReactNode, Ref } from 'react';

import logoIcon from '@/assets/logo-icon.png';

interface AuthHeroProps {
  children: ReactNode;
  containerRef?: Ref<HTMLDivElement>;
}

export function AuthHero({ children, containerRef }: AuthHeroProps) {
  return (
    <div
      ref={containerRef}
      className="dark relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#221a45] to-[#0c0e1c] p-4"
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle, white 1px, transparent 1px), radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          backgroundPosition: '0 0, 14px 14px',
        }}
      />
      <div className="pointer-events-none absolute -top-32 -left-32 size-96 rounded-full bg-primary/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -bottom-32 size-96 rounded-full bg-[#5b3df5]/30 blur-3xl" />
      <div className="relative mb-7 flex flex-col items-center gap-3">
        <div className="relative flex size-24 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 animate-[spin_16s_linear_infinite] rounded-full border border-dashed border-violet-400/40"
          />
          <span
            aria-hidden
            className="absolute inset-1.5 animate-[spin_11s_linear_infinite_reverse] rounded-full border border-dotted border-blue-400/30"
          />
          <span aria-hidden className="absolute inset-3 rounded-full bg-primary/25 blur-md" />
          <img
            src={logoIcon}
            alt=""
            className="relative size-14 rounded-2xl shadow-lg shadow-primary/40"
          />
        </div>
        <span className="font-heading bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-3xl font-bold text-transparent">
          LogFlow
        </span>
      </div>
      {children}
    </div>
  );
}
