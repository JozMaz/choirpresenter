"use client";

import { icons, LucideProps } from "lucide-react";

export type IconName = keyof typeof icons;

interface IconProps extends Omit<LucideProps, "color" | "size"> {
  name: IconName;
  color?: string;
  size?: number | string;
}

export default function Icon({
  name,
  color = "currentColor",
  size = 16,
  ...rest
}: IconProps) {
  const LucideIcon = icons[name];
  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found in lucide-react`);
    return null;
  }
  return <LucideIcon color={color} size={size} {...rest} />;
}
