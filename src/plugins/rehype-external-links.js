import { visit } from "unist-util-visit";

/**
 * Rehype plugin to add target="_blank" and rel="noopener noreferrer"
 * to all external links (links starting with http:// or https://)
 */
export default function rehypeExternalLinks() {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (
        node.tagName === "a" &&
        node.properties?.href &&
        /^https?:\/\//.test(node.properties.href)
      ) {
        node.properties.target = "_blank";
        node.properties.rel = "noopener noreferrer";
      }
    });
  };
}
