interface IconProps {
  className?: string;
}

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className ?? "h-5 w-5"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const IconUtensils = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" />
    <path d="M6 12v9" />
    <path d="M18 3c-1.7 0-3 2-3 5s1.3 5 3 5v8" />
  </Svg>
);

export const IconMilk = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 2h6" />
    <path d="M9 2v3L6 9v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9l-3-4V2" />
    <path d="M6 13c2 -1.5 4 1.5 6 0s4 1.5 6 0" />
  </Svg>
);

export const IconCup = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 4h11l-1.5 16a2 2 0 0 1-2 1.8h-4A2 2 0 0 1 7.5 20L6 4Z" />
    <path d="M17 8h2.5a1.5 1.5 0 0 1 0 3H16.6" />
    <path d="M7 9h9.5" />
  </Svg>
);

export const IconWine = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 2h8s0 5-1 7c-.8 1.6-2 2.5-3 2.5S9.8 10.6 9 9C8 7 8 2 8 2Z" />
    <path d="M12 11.5V20" />
    <path d="M8 22h8" />
  </Svg>
);

export const IconWheat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 22V8" />
    <path d="M12 8c-3 0-5-2-5-5 3 0 5 2 5 5Z" />
    <path d="M12 8c3 0 5-2 5-5-3 0-5 2-5 5Z" />
    <path d="M12 14c-3 0-5-2-5-5 3 0 5 2 5 5Z" />
    <path d="M12 14c3 0 5-2 5-5-3 0-5 2-5 5Z" />
    <path d="M12 20c-3 0-5-2-5-5 3 0 5 2 5 5Z" />
    <path d="M12 20c3 0 5-2 5-5-3 0-5 2-5 5Z" />
  </Svg>
);

export const IconApple = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 7c-1-2-3-3-5-2.5C4 5.3 3 8.7 4 12c1 3.6 3.5 8 6 8 1 0 1.4-.5 2-.5s1 .5 2 .5c2.5 0 5-4.4 6-8 1-3.3 0-6.7-3-7.5-2-.5-4 .5-5 2.5Z" />
    <path d="M12 7c0-2.5 1.5-4 3.5-4.5" />
  </Svg>
);

export const CATEGORY_ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  utensils: IconUtensils,
  milk: IconMilk,
  "cup-soda": IconCup,
  wine: IconWine,
  wheat: IconWheat,
  apple: IconApple,
};

export const IconLogout = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </Svg>
);

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export const IconArrowLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);

export const IconX = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Svg>
);

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4-4" />
  </Svg>
);

export const IconStore = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 9 5 3h14l2 6" />
    <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
    <path d="M4 12v9h16v-9" />
    <path d="M9 21v-6h6v6" />
  </Svg>
);

export const IconCalendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </Svg>
);

export const IconAlert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 10v4" />
    <path d="M12 17.5v.01" />
  </Svg>
);

export const IconTrendUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </Svg>
);

export const IconTrendDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m3 7 6 6 4-4 8 8" />
    <path d="M15 17h6v-6" />
  </Svg>
);

export const IconSparkles = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
  </Svg>
);

export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </Svg>
);

export const IconBox = (p: IconProps) => (
  <Svg {...p}>
    <path d="m21 8-9-5-9 5v8l9 5 9-5V8Z" />
    <path d="m3 8 9 5 9-5" />
    <path d="M12 13v8" />
  </Svg>
);

export const IconTag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2H2v10l9.3 9.3a2 2 0 0 0 2.8 0l7.2-7.2a2 2 0 0 0 0-2.8L12 2Z" />
    <circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2 4 5.5v5c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11v-5L12 2Z" />
  </Svg>
);

export const IconLoader = (p: IconProps) => (
  <svg className={p.className ?? "h-5 w-5"} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);
