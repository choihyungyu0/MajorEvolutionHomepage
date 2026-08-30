import Image from "next/image";
import Link from "next/link";
import { brandLogoV2 } from "@/lib/brand-assets";
import styles from "./brand-logo.module.css";

type BrandLogoProps = {
  href?: string;
  tagline?: string;
  inverse?: boolean;
  compact?: boolean;
  className?: string;
};

export function BrandLogo({
  href = "/",
  tagline,
  inverse = false,
  compact = false,
  className,
}: BrandLogoProps) {
  const classes = [
    styles.logo,
    inverse ? styles.inverse : "",
    compact ? styles.compact : "",
    className ?? "",
  ].filter(Boolean).join(" ");

  return (
    <Link href={href} className={classes} aria-label="너의 교수님은?">
      <Image
        src={inverse ? brandLogoV2.markMonoWhite : brandLogoV2.mark}
        alt=""
        aria-hidden="true"
        width={42}
        height={42}
        priority
        unoptimized
      />
      <span className={styles.copy}>
        <span className={styles.wordmark}>
          <span>너의</span>
          <strong>교수님</strong>
          <em>은?</em>
        </span>
        {tagline ? <small>{tagline}</small> : null}
      </span>
    </Link>
  );
}
