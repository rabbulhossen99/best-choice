import { records } from "./db.mjs";
import { settings, publicProduct, categoryVisible } from "./commerce.mjs";

export const BRAND_NAME = "Best Choice";
export const BRAND_DESCRIPTION =
  "Best Choice is a trusted online store for health, wellness and everyday essentials delivered across Bangladesh.";
export const BRAND_IMAGE = "/assets/vitaboost-main.jpg";
export const DEFAULT_TITLE = `${BRAND_NAME} | Shop Online in Bangladesh`;

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

// Meta title/description for product and category pages, falling back to the
// record's own name and description when the SEO fields are left empty.
export function pageMeta(db, path) {
  const [, kind, slug] = path.match(/^\/(product|category)\/([^/]+)\/?$/) || [];
  if (kind === "product") {
    const product = publicProduct(
      db,
      records(db, "products").find((p) => p.slug === slug),
    );
    if (!product) return null;
    const variant = product.variants[0];
    return {
      title: product.metaTitle || product.name,
      description: product.metaDescription || product.detail || product.description,
      image: product.images[0],
      type: "product",
      price: variant ? variant.price / 100 : null,
    };
  }
  if (kind === "category") {
    const category = records(db, "categories").find(
      (c) => c.slug === slug && categoryVisible(db, c.id),
    );
    if (!category) return null;
    return {
      title: category.metaTitle || category.name,
      description: category.metaDescription || "",
      image: category.image,
      type: "website",
      price: null,
    };
  }
  return null;
}

// Server-rendered tags so crawlers that do not run JavaScript (Facebook,
// WhatsApp, Messenger link previews) see the page's meta data.
export function renderIndex(db, path, html, origin) {
  let meta;
  try {
    meta = pageMeta(db, path);
  } catch {
    meta = null;
  }
  const store = BRAND_NAME,
    absolute = (url) => (url ? new URL(url, origin).href : ""),
    description = (meta?.description || BRAND_DESCRIPTION).replace(/\s+/g, " ").trim().slice(0, 300),
    title = meta ? `${meta.title} · ${store}` : DEFAULT_TITLE;
  if (!meta) {
    return html
      .replace(/<title>[^<]*<\/title>/, () => `<title>${escape(title)}</title>`)
      .replace(/<meta name="description" content="[^"]*"\s*\/?\>/, () => `<meta name="description" content="${escape(description)}" />`);
  }
  const tags = [
    ["name", "title", meta.title],
    ["property", "og:type", meta.type],
    ["property", "og:url", new URL(path, origin).href],
    ["property", "og:title", meta.title],
    ["property", "og:description", description],
    ["property", "og:image", absolute(meta.image)],
    ["property", "og:site_name", store],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", meta.title],
    ["name", "twitter:description", description],
    ["name", "twitter:image", absolute(meta.image)],
    ...(meta.price !== null
      ? [
          ["property", "product:price:amount", String(meta.price)],
          ["property", "product:price:currency", "BDT"],
        ]
      : []),
  ]
    .filter(([, , content]) => content)
    .map(
      ([attr, name, content]) =>
        `<meta ${attr}="${name}" content="${escape(content)}" data-seo />`,
    )
    .join("\n    ");
  // Function replacements keep "$" sequences in store content literal.
  return html
    .replace(
      /<title>[^<]*<\/title>/,
      () => `<title>${escape(title)}</title>`,
    )
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, (tag) =>
      description
        ? `<meta name="description" content="${escape(description)}" />`
        : tag,
    )
    .replace(/<link rel="canonical" href="[^"]*"\s*\/?>/, () =>
      `<link rel="canonical" href="${escape(new URL(path, origin).href)}" />`,
    )
    .replace("</head>", () => `    ${tags}\n  </head>`);
}
