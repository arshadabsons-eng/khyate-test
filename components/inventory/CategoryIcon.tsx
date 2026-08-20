import {
  IconShirt,
  IconShirtSport,
  IconJacket,
  IconHanger,
  IconHanger2,
  IconTie,
  IconShoe,
  IconNeedleThread,
  IconScissors,
  IconSparkles,
  IconStar,
  IconCrown,
  IconHeart,
  IconBox,
  IconCategory,
  type Icon,
} from "@tabler/icons-react";

// Name → component map. Unknown names fall back to a generic category icon,
// so seed data can reference any of these without risking an import error.
const MAP: Record<string, Icon> = {
  IconShirt,
  IconShirtSport,
  IconJacket,
  IconHanger,
  IconHanger2,
  IconTie,
  IconShoe,
  IconNeedleThread,
  IconScissors,
  IconSparkles,
  IconStar,
  IconCrown,
  IconHeart,
  IconBox,
};

export function CategoryIcon({
  name,
  size = 18,
  className,
}: {
  name: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const Cmp = (name && MAP[name]) || IconCategory;
  return <Cmp size={size} className={className} />;
}
