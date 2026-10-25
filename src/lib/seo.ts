// Keeps the document head in sync with the current page's SEO meta data. The
// server renders the same tags for product and category URLs (server/seo.mjs).
export type PageMeta = {
  title: string;
  description?: string;
  image?: string;
  type?: "product" | "website";
  price?: number | null;
};
const brandName = "Best Choice";
const brandDescription =
  "Best Choice is a trusted online store for health, wellness and everyday essentials delivered across Bangladesh.";
const brandImage = "/assets/vitaboost-main.jpg";
const defaultTitle = `${brandName} | Shop Online in Bangladesh`;
const defaultDescription =
  document
    .querySelector('meta[name="description"]')
    ?.getAttribute("content") || "";
function setTag(attr: "name" | "property", key: string, content?: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!content) return tag?.remove();
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}
function setCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
}
export function applySeo(store: string, meta: PageMeta | null) {
  const effectiveStore = brandName;
  const description = meta?.description?.replace(/\s+/g, " ").trim().slice(0, 300);
  const title = meta ? `${meta.title} · ${effectiveStore}` : defaultTitle;
  document.title = title;
  setTag("name", "description", description || defaultDescription || brandDescription);
  setTag("name", "title", title);
  setTag("property", "og:type", meta?.type || "website");
  const canonical = meta ? location.href : location.origin + "/";
  setCanonical(canonical);
  setTag("property", "og:url", canonical);
  setTag("property", "og:title", title);
  setTag("property", "og:description", description || brandDescription);
  setTag(
    "property",
    "og:image",
    meta?.image ? new URL(meta.image, location.origin).href : new URL(brandImage, location.origin).href,
  );
  setTag("property", "og:site_name", brandName);
  setTag("name", "twitter:card", "summary_large_image");
  setTag("name", "twitter:title", title);
  setTag("name", "twitter:description", description || brandDescription);
  setTag("name", "twitter:image", meta?.image ? new URL(meta.image, location.origin).href : new URL(brandImage, location.origin).href);
  const price = meta?.price ?? null;
  setTag("property", "product:price:amount", price === null ? undefined : String(price));
  setTag("property", "product:price:currency", price === null ? undefined : "BDT");
}
