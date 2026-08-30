import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const canonicalPaths = [
    "",
    "/tutorial",
    "/research",
    "/research/conditions",
    "/co-design",
    "/result",
    "/result/compare",
    "/paper",
    "/paper/reader",
    "/professors",
    "/project-professors",
    "/project-execution",
    "/project-meeting",
    "/quest",
    "/quest/first-line",
    "/quest/silence-rescue",
    "/quest/email-guard",
    "/mentor-loop",
    "/portfolio",
  ];

  return canonicalPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
}
