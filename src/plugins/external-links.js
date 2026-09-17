/**
 * Sätteri HAST plugin to add target="_blank" and rel="noopener noreferrer"
 * to all external links (links starting with http:// or https://)
 */
export default {
  name: "external-links",
  element: {
    filter: ["a"],
    visit(node, ctx) {
      const href = node.properties?.href;
      if (typeof href === "string" && /^https?:\/\//.test(href)) {
        ctx.setProperty(node, "target", "_blank");
        ctx.setProperty(node, "rel", "noopener noreferrer");
      }
    },
  },
};
