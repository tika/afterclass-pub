import Image from "next/image";
import type * as React from "react";

import { cn } from "@/lib/utils";

interface LogoProps extends React.ComponentPropsWithoutRef<"div"> {
  /** Size in pixels for the Image. Defaults to 32. Use className for container sizing (e.g. h-6 w-6 md:h-7 md:w-7). */
  size?: number;
}

export function Logo({ size = 32, className, ...props }: LogoProps) {
  return (
    <div
      className={cn("relative shrink-0 overflow-hidden rounded-lg h-7 w-7", className)}
      {...props}
    >
      <Image
        src="/logo-gradient.png"
        alt="Afterclass"
        width={size}
        height={size}
        className="size-full object-contain"
        priority
      />
    </div>
  );
}
