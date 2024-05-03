import fs from "node:fs/promises";

import { marked, set_active_link } from "./util.js";

const template_replace = (template, replacements) =>
  template.replace(/@([a-z]+)/g, (match, word) => replacements[word] || match);

/**
 * @param {string} str
 * @returns
 */
function page_name(str) {
  return str
    .replace(/^ch[0-9]+-[0-9]+-/, "")
    .replace(/-/g, " ")
    .split(" ")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ")
    .split(".")
    .slice(0, -1)
    .join(".");
}

async function build_page(file, options) {
  const template = (options && options.template) || "";
  const content = await fs.readFile(file, "utf8");
  const title = page_name(file.split("/").pop());
  set_active_link(options.active_link || file.split("/").pop());
  return template_replace(template, {
    title,
    body: marked(content),
    summary: marked(options.summary || ""),
  });
}

async function link_page(file, previous, next) {
  const content = await fs.readFile(file, "utf8");
  let index = content.indexOf('<div class="footnote">');
  if (index === -1) index = content.lastIndexOf("</article>");
  if (index === -1) console.warn(`Unable to link ${file}`);
  return index === -1
    ? content
    : content.slice(0, index) +
        '<div class="prevnext">' +
        (previous ? `<a href="${previous}" class="prev"></a>` : "<div></div>") +
        (next ? `<a href="${next}" class="next"></a></div>` : "<div></div>") +
        content.slice(index);
}

export { build_page, link_page };
