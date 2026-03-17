import Image from "next/image";
import { cn } from "@/lib/utils";

interface TeamFlagProps {
  slug: string;
  name: string;
  /** sm=20px  md=28px  lg=80px wide */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_DIMS: Record<string, [number, number]> = {
  sm: [20, 14],
  md: [28, 19],
  lg: [80, 54],
};

export function TeamFlag({ slug, name, size = "sm", className }: TeamFlagProps) {
  const [width, height] = SIZE_DIMS[size]!;
  return (
    <Image
      src={`/flags/${slug}.png`}
      alt={`${name} flag`}
      width={width}
      height={height}
      className={cn("inline-block rounded-sm object-cover", className)}
    />
  );
}
