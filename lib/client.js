import { initSimnet } from "@hirosystems/clarinet-sdk-browser";
import Misbehave from "misbehave";

import { Cl } from "@stacks/transactions";
import { prism, render_events } from "./util.js";

const regExAssertionFailed =
  /ShortReturn\(AssertionFailed\(Sequence\(String\((".*")/;

const regExGeneralError =
  /Contract deployment runtime error: ST000000000000000000002AMW42H.contract -> (.*)/;
/**
 * @param {string} code
 * @param {HTMLPreElement} result_container
 * @param {{ mineBlock?: number, expected_output?: string, hint?: string, validation_code?: string[] }} options
 */
async function eval_clarity_code(code, result_container, options) {
  if (!options) options = {};
  const simnet = await initSimnet();
  try {
    await simnet.initEmtpySession();
    simnet.mintSTX("ST000000000000000000002AMW42H", BigInt(10_000_000));
  } catch (e) {
    console.log("error initializing simnet:", e);
  }

  if (options.mineBlock) simnet.mineEmptyBlock(options.mineBlock);

  let validation_code = options.validation_code
    ? `\n\n;; --- Exercise validation code ---\n${options.validation_code}`
    : "";

  let resultHex;
  try {
    /*
    resultHex = simnet.runSnippet(`${code}${validation_code}`);
    let result = hexToCV(resultHex);
    let events = [];
*/
    // option 2
    const response = simnet.deployContract(
      "contract",
      `${code}${validation_code}`,
      {
        clarity_version: 2,
      },
      "ST000000000000000000002AMW42H"
    );
    const { result, events } = response;

    let formattedResult = prism.highlight(
      Cl.prettyPrint(result, 2),
      prism.languages.clarity,
      "Clarity"
    );
    let formattedEvents = render_events(events);

    if (options.expected_output || options.validation_code) {
      result_container.classList.remove("pass", "fail");
      result_container.classList.add(
        !options.expected_output ||
          Cl.prettyPrint(result) === options.expected_output
          ? "pass"
          : "fail"
      );
    }

    result_container.innerHTML = events.length
      ? `${formattedResult}\n${formattedEvents}`
      : formattedResult;
  } catch (e) {
    result_container.classList.remove("pass");
    console.warn("error executing snippet: ", typeof e, e);
    if (typeof e === "string") {
      // handle validation code like (asserts! false "That was false.")
      let result = e.match(regExAssertionFailed);
      if (
        (options.expected_output || options.validation_code) &&
        result &&
        result.length > 1
      ) {
        result_container.classList.remove("pass", "fail");
        result_container.classList.add("fail");
        result_container.innerHTML = `<span class="error">${result[1]}</span>`;
      } else {
        // handle other deployment errors
        result = e.match(regExGeneralError);
        if (result && result.length > 1) {
          result_container.classList.remove("pass", "fail");
          result_container.classList.add("fail");
          result_container.innerHTML = `<span class="error">${result[1]}</span>`;
        } else {
          // handle all other errors
          result_container.innerHTML = `<span class="error">${e}</span>`;
        }
      }
    } else {
      result_container.innerHTML = `<span class="error">${e.toString()}</span>`;
    }
  }
}

/**
 * @param {string} text
 */
function copy_clipboard(text) {
  navigator.clipboard.writeText(text);
}

function new_line() {
  var ta = document.createElement("textarea");
  ta.value = "\n";
  return ta.value.length === 2 ? "\r\n" : "\n";
}

async function start() {
  const fields = document.querySelectorAll('pre[class*="language-"]');
  const ln = new_line();
  fields.forEach((field) => {
    field.parentElement
      .querySelector(".copy")
      .addEventListener("click", () => copy_clipboard(field.textContent));
    const play_button = field.parentElement.querySelector(".play");
    if (play_button) {
      const options =
        (field.parentElement.dataset.options &&
          JSON.parse(field.parentElement.dataset.options)) ||
        {};
      if (options.validation_code) {
        const validation_code_container = document.createElement("pre");
        validation_code_container.className =
          " language-clarity validation_code";
        validation_code_container.innerHTML = prism.highlight(
          ";; --- Exercise validation code ---\n" + options.validation_code,
          prism.languages.clarity,
          "Clarity"
        );
        field.parentElement.appendChild(validation_code_container);
      }
      const result_container = document.createElement("pre");
      const code_container = field.querySelector("code");
      result_container.className = "result";
      field.parentElement.appendChild(result_container);
      play_button.addEventListener("click", () =>
        eval_clarity_code(field.textContent, result_container, options)
      );
      if (options.expected_output || options.validation_code) {
        field.parentElement.classList.add("exercise");
        field.parentElement.dataset.hint = options.hint;
        if (options.expected_output)
          result_container.dataset.expected_output = options.expected_output;
      }
      if (!options.noneditable) {
        const reset_button = field.parentElement.querySelector(".reset");
        if (reset_button) {
          const original_content = code_container.innerHTML;
          reset_button.addEventListener(
            "click",
            () => (code_container.innerHTML = original_content)
          );
        }
        const share_button = field.parentElement.querySelector(".share");
        if (share_button)
          share_button.addEventListener("click", () => {
            let link =
              document.location.href.split("#")[0] +
              "#e" +
              encodeURIComponent(code_container.innerText);
            copy_clipboard(link);
            alert("A shareable link for this snippet was copied to clipboard.");
          });
        // todo: check this ts error
        // @ts-ignore
        const editor = new Misbehave(code_container, {
          //autoIndent: false, // This breaks newlines for some reason.
          autoOpen: true,
          autoStrip: true,
          overwrite: true,
          replaceTab: true,
          softTabs: false,
          oninput: (code) =>
            (code_container.innerHTML = prism.highlight(
              code,
              prism.languages.clarity,
              "Clarity"
            )),
        });
        // custom autoIndent handler to allow newlines but not auto-indent.
        editor.handler.autoIndent = (prefix, selected, suffix) => ({
          prefix: prefix + ln,
          selected: "",
          suffix: suffix || "",
        });
        field.addEventListener("click", (event) => {
          if (event.target === field) editor.focus(); //TODO- set caret to end if clicked after the code block.
        });
      }
    }
  });
}

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", start)
  : setTimeout(start, 1);
