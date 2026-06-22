import { cn } from "@/lib/utils";
import logoAlpha from "@/assets/logo-alpha.png";

type BrandLogoSize = "sm" | "md" | "lg" | "xl";

interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
}

const SIZE_MAP: Record<
  BrandLogoSize,
  { box: string; img: string; px: number; inset: string; blur: string; glow: string }
> = {
  sm: {
    box: "rounded-xl p-1.5",
    img: "size-7",
    px: 28,
    inset: "-inset-1",
    blur: "blur-[3px]",
    glow: "dark:shadow-[0_0_16px_hsla(24,95%,58%,0.25)]",
  },
  md: {
    box: "rounded-2xl p-2",
    img: "size-10",
    px: 40,
    inset: "-inset-1.5",
    blur: "blur-[3px]",
    glow: "dark:shadow-[0_0_24px_hsla(24,95%,58%,0.28)]",
  },
  lg: {
    box: "rounded-2xl p-2.5",
    img: "size-14",
    px: 56,
    inset: "-inset-2",
    blur: "blur-[4px]",
    glow: "dark:shadow-[0_0_28px_hsla(24,95%,58%,0.30)]",
  },
  xl: {
    box: "rounded-3xl p-3",
    img: "size-20",
    px: 80,
    inset: "-inset-2.5",
    blur: "blur-[5px]",
    glow: "dark:shadow-[0_0_36px_hsla(24,95%,58%,0.32)]",
  },
};

export function BrandLogo({ size = "md", className }: BrandLogoProps) {
  const s = SIZE_MAP[size];
  return (
    <div className={cn("relative inline-block", className)}>
      <div
        className={cn(
          "absolute rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 dark:from-primary/45 dark:to-primary/15",
          s.inset,
          s.blur,
        )}
        aria-hidden
      />
      <div
        className={cn(
          "relative bg-card/90 dark:bg-card/70 ring-1 ring-primary/20 dark:ring-primary/40 shadow-sm",
          s.box,
          s.glow,
        )}
      >
        <img src={logoAlpha} alt="AURA Consumo" width={s.px} height={s.px} className={s.img} />
      </div>
    </div>
  );
}
