"use client";

/**
 * Round avatar: the user's photo when available, otherwise their initial.
 * The photo is overlaid on the initial circle; if it fails to load it hides
 * itself and the initial shows through.
 */
export function Avatar({
  name,
  size = "md",
  tone = "blue",
  avatarUrl,
  lazy = false,
}: {
  name: string;
  size?: "xxs" | "xs" | "sm" | "md" | "lg";
  tone?: "blue" | "neutral";
  avatarUrl?: string | null;
  lazy?: boolean;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const sizes = {
    xxs: "h-4 w-4 text-[8px]",
    xs: "h-7 w-7 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-base",
    lg: "h-16 w-16 text-2xl",
  } as const;
  const tones = {
    blue: "bg-[#4F46E5] text-white",
    neutral: "bg-neutral-200 text-[#211D33]",
  } as const;
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ${sizes[size]} ${tones[tone]}`}
    >
      {initial}
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt={name}
          loading={lazy ? "lazy" : undefined}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}
