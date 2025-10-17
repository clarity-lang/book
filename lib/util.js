import { marked } from "marked";
import prism from "prismjs";

import "prismjs/components/prism-typescript.js";
import "prismjs/components/prism-toml.js";
import "prismjs/components/prism-json.js";
import { Cl } from "@stacks/transactions";
import { markedHighlight } from "marked-highlight";

function escape_html(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function strip_ansi_codes(str) {
  return str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );
}

function json_parse_safe(str, def) {
  try {
    return JSON.parse(str);
  } catch (error) {
    return def;
  }
}

function number_format(number, decimals) {
  var parts = (number / Math.pow(10, decimals)).toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

/**
 * @param {import("@hirosystems/clarinet-sdk-browser").ClarityEvent[]} events
 * @returns
 */
function render_events(events) {
  if (!events || !events.length) return "";
  return events
    .map((event, index) => {
      switch (event.event) {
        case "print_event":
          return `<span class="event print" data-index="${index}" data-topic="${escape_html(
            event.data.topic
          )}"><code>${prism.highlight(
            Cl.prettyPrint(event.data.value || Cl.none()),
            prism.languages.clarity,
            "Clarity"
          )}</code></span>`;
        case "stx_transfer_event":
          return `<span class="event stx_transfer" data-index="${index}" data-topic="STX transfer"><span class="amount">${number_format(
            event.data.amount,
            6
          )} STX</span><span class="sender">${
            event.data.sender
          }</span><span class="recipient">${
            event.data.recipient
          }</span></span>`;
        default:
          return `<span class="event" data-index="${index}">${escape_html(
            JSON.stringify(event)
          )}</span>`;
      }
    })
    .join("");
}

function simple_form(name) {
  return RegExp("(\\()" + name + "(?=[\\s\\)])");
}
// booleans and numbers
function primitive(pattern) {
  return RegExp("([\\s([])" + pattern + "(?=[\\s)])");
}

// Open parenthesis for look-behind
const par = "(\\()";
const endpar = "(?=\\))";
// End the pattern with look-ahead space
const space = "(?=\\s)";

prism.languages.clarity = {
  // Three or four semicolons are considered a heading.
  heading: {
    pattern: /;;;.*/,
    alias: ["comment", "title"],
  },
  comment: /;;.*/,
  string: [
    {
      pattern: /"(?:[^"\\]|\\.)*"/,
      greedy: true,
    },
    {
      pattern: /0x[0-9a-fA-F]*/,
      greedy: true,
    },
  ],
  symbol: {
    pattern: /'[^()#'\s]+/,
    greedy: true,
  },
  keyword: [
    {
      pattern: RegExp(
        par +
          "(?:or|and|xor|not|begin|let|if|ok|err|unwrap\\!|unwrap-err\\!|unwrap-panic|unwrap-err-panic|match|try\\!|asserts\\!|\
map-get\\?|var-get|contract-map-get\\?|get|tuple|\
define-public|define-private|define-constant|define-map|define-data-var|\
define-fungible-token|define-non-fungible-token|\
define-read-only)" +
          space
      ),
      lookbehind: true,
    },
    {
      pattern: RegExp(par + "(?:is-eq|is-some|is-none|is-ok|is-er)" + space),
      lookbehind: true,
    },
    {
      pattern: RegExp(
        par +
          "(?:var-set|map-set|map-delete|map-insert|\
ft-transfer\\?|nft-transfer\\?|nft-mint\\?|ft-mint\\?|nft-get-owner\\?|ft-get-balance\\?|\
contract-call\\?)" +
          space
      ),
      lookbehind: true,
    },
    {
      pattern: RegExp(
        par +
          "(?:list|map|filter|fold|len|concat|append|as-max-len\\?|to-int|to-uint|\
buff|hash160|sha256|sha512|sha512/256|keccak256|true|false|none)" +
          space
      ),
      lookbehind: true,
    },
    {
      pattern: RegExp(
        par +
          "(?:as-contract|contract-caller|tx-sender|block-height|at-block|get-block-info\\?)" +
          space
      ),
      lookbehind: true,
    },
    {
      pattern: RegExp(par + "(?:is-eq|is-some|is-none|is-ok|is-err)" + space),
      lookbehind: true,
    },
  ],
  boolean: /(?:false|true|none)/,
  number: {
    pattern: primitive("[-]?u?\\d+"),
    lookbehind: true,
  },
  address: {
    pattern:
      /([\s()])(?:\'[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{28,41})(?=[()\s]|$)/,
    lookbehind: true,
  },
  operator: {
    pattern: /(\()(?:[-+*\/]|[<>]=?|=>?)(?=[()\s]|$)/,
    lookbehind: true,
  },
  function: {
    pattern: /(\()[^()'\s]+(?=[()\s]|$)/,
    lookbehind: true,
  },
  punctuation: /[()']/,
};

// marked.use(
//   markedHighlight({
//     langPrefix: "language-",
//     highlight: function (code, language) {
//       return prism.highlight(
//         code,
//         prism.languages[language.toLowerCase()] || prism.languages.plain,
//         language
//       );
//     },
//   })
// );

let active_link = "";

const render_superscript = (text) =>
  text.replace(/([0-9]+)\^([0-9]+)/, (_, n, e) => `${n}<sup>${e}</sup>`);

const render_footnotes = (text) => {
  const [_, ref] = text.match(/^\[\^([^\]]+)\]/) || [];
  return ref
    ? `<div class="footnote"><sup id="fn:${ref}">${ref}</sup>${text.substring(
        3 + ref.length
      )} <a href="#fnref:${ref}">&#8629;</a></div>`
    : text.replace(
        /\[\^([^\]]+)\](?!\()/g,
        (_, ref) =>
          `<sup id="fnref:${ref}"><a href="#fn:${ref}">${ref}</a></sup>`
      );
};

const renderer = {
  code(code, infostring, escaped) {
    let codeText =
      typeof code === "string" ? code : code && code.text ? code.text : "";
    const comma = (code.lang && code.lang.indexOf(",")) || -1;
    const lang = comma !== -1 ? code.lang.slice(0, comma) : code.lang || "";
    let options = {};
    if (comma !== -1) {
      try {
        options = JSON.parse(code.lang.slice(comma + 1));
      } catch (error) {}
    }
    const clarity = lang.toLowerCase() === "clarity";

    // if (this.options.highlight) {
    //   const out = this.options.highlight(codeText, lang);
    //   if (out != null && out !== codeText) {
    //     escaped = true;
    //     codeText = out;
    //   }
    // }
    codeText = codeText.replace(/\n$/, "") + "\n";
    const copy_button = '<button class="copy" title="Copy"></button>';
    const play_button =
      clarity && !options.nonplayable
        ? '<button class="play" title="Execute"></button>'
        : "";
    const editable =
      !options.noneditable && play_button
        ? ' contenteditable autocorrect="off" autocapitalize="off" spellcheck="false"'
        : "";
    const reset_button =
      editable && '<button class="reset" title="Reset"></button>';

    if (!lang)
      return `<div class="code"><div class="buttons">${copy_button}${reset_button}${play_button}</div><pre><code${editable}>${
        escaped ? codeText : escape_html(codeText)
      }</code></pre></div>\n`;

    const class_name = "language-" + escape_html(lang);
    return `<div class="code" data-language="${escape_html(
      lang
    )}" data-options="${escape_html(
      JSON.stringify(options)
    )}"><div class="buttons">${copy_button}${reset_button}${play_button}</div><pre class="${class_name}"><code class="${class_name}"${editable}>${
      escaped ? codeText : escape_html(codeText)
    }</code></pre></div>\n`;
  },
  image(token) {
    const { href, title, text } = token;
    let result = `<img src="${href}" alt="${text || ""}"`;
    if (title) result += ` title="${title}"`;
    result += ">";
    return result;
  },
  link(token) {
    let { href, title, text } = token;
    if (!/^https?:\/\//.test(href)) {
      let hash = href.indexOf("#");
      if (hash < 0) hash = 0;
      if (href.substr(hash - 3, 3) === ".md")
        href =
          href.slice(0, hash - 3) + ".html" + (hash ? href.slice(hash) : "");
    }
    const active = href === active_link && href !== "";
    let result = title
      ? `<a href="${href}" title="${title}">${text}</a>`
      : `<a href="${href}">${text}</a>`;
    if (active) result = result.replace("<a ", '<a class="selected" ');
    return result;
  },
  // paragraph(token) {
  //   // token.text is already HTML with inline tokens processed
  //   let html = token.text || "";
  //   html = render_superscript(render_footnotes(html));
  //   return `<p>${html}</p>\n`;
  // },
};
marked.use({ renderer });

function set_active_link(link) {
  active_link = link.substr(-3) === ".md" ? link.slice(0, -3) + ".html" : link;
}

function preprocess_footnotes(markdown) {
  // Extract footnote definitions
  const footnotes = {};
  let main = markdown.replace(
    /\[\^([\w-]+)\]:\s+([\s\S]+?)(?=\n\n|$)/g,
    (m, name, content) => {
      footnotes[name] = content.trim();
      return "";
    }
  );

  // Replace references with HTML
  main = main.replace(/\[\^([\w-]+)\]/g, (m, name) => {
    if (footnotes[name]) {
      return `<sup id="fnref:${name}"><a href="#fn:${name}">${name}</a></sup>`;
    }
    return m;
  });

  // Append footnotes section
  if (Object.keys(footnotes).length) {
    main += '\n<hr class="footnotes-sep">\n<section class="footnotes">\n<ol>\n';
    for (const name in footnotes) {
      main += `<li id="fn:${name}">${footnotes[name]} <a href="#fnref:${name}">&#8617;</a></li>\n`;
    }
    main += "</ol>\n</section>\n";
  }
  return main;
}

export {
  escape_html,
  json_parse_safe,
  render_events,
  strip_ansi_codes,
  marked,
  prism,
  set_active_link,
  preprocess_footnotes,
};
