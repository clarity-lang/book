import marked from "marked";
import prism from "prismjs";

import "prismjs/components/prism-typescript.js";
import "prismjs/components/prism-toml.js";
import "prismjs/components/prism-json.js";
import { Cl } from "@stacks/transactions";

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

marked.setOptions({
  langPrefix: "language-",
  highlight: function (code, language) {
    return prism.highlight(
      code,
      prism.languages[language.toLowerCase()] || prism.languages.plain,
      language
    );
  },
});

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
    const comma = (infostring && infostring.indexOf(",")) || -1;
    const lang = comma !== -1 ? infostring.slice(0, comma) : infostring || "";
    let options = {};
    if (comma !== -1) {
      try {
        options = JSON.parse(infostring.slice(comma + 1));
      } catch (error) {}
    }
    const clarity = lang.toLowerCase() === "clarity";
    if (this.options.highlight) {
      const out = this.options.highlight(code, lang);
      if (out != null && out !== code) {
        escaped = true;
        code = out;
      }
    }
    code = code.replace(/\n$/, "") + "\n";
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
        escaped ? code : escape_html(code)
      }</code></pre></div>\n`;
    const class_name = this.options.langPrefix + escape_html(lang);
    return `<div class="code" data-language="${escape_html(
      lang
    )}" data-options="${escape_html(
      JSON.stringify(options)
    )}"><div class="buttons">${copy_button}${reset_button}${play_button}</div><pre class="${class_name}"><code class="${class_name}"${editable}>${
      escaped ? code : escape_html(code)
    }</code></pre></div>\n`;
  },
  link(href, title, text) {
    if (!/^https?:\/\//.test(href)) {
      let hash = href.indexOf("#");
      if (hash < 0) hash = 0;
      if (href.substr(hash - 3, 3) === ".md")
        href =
          href.slice(0, hash - 3) + ".html" + (hash ? href.slice(hash) : "");
    }
    // else
    // 	{
    // 	//TODO- fetch OGP and render a nice link.
    // 	//const ogp = ogp_scraper();
    // 	}
    const active = href === active_link && href !== "";
    let result = marked.Renderer.prototype.link.call(marked, href, title, text);
    if (active) result = '<a class="selected" ' + result.substr(3);
    return result;
  },
  paragraph(text) {
    return marked.Renderer.prototype.paragraph.call(
      marked,
      render_superscript(render_footnotes(text))
    );
  },
  text(text) {
    return marked.Renderer.prototype.text.call(
      marked,
      render_superscript(text)
    );
  },
};
marked.use({ renderer });

function set_active_link(link) {
  active_link = link.substr(-3) === ".md" ? link.slice(0, -3) + ".html" : link;
}

export {
  escape_html,
  json_parse_safe,
  render_events,
  strip_ansi_codes,
  marked,
  prism,
  set_active_link,
};
