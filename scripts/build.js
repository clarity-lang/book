#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

import { build_page, link_page } from "../lib/builder.js";

const __dirname = import.meta.dirname;

const [, , input, output] = process.argv;
const input_path = path.resolve(__dirname, input || "../src");
const output_path = path.resolve(__dirname, output || "../build");

async function readdir_sorted(dir, subdir) {
  let entries = [];
  for await (const d of await fs.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory())
      entries = entries.concat(await readdir_sorted(entry, true));
    else if (d.isFile()) entries.push({ entry, name: d.name });
  }
  return subdir
    ? entries
    : entries.sort((a, b) => a.entry.localeCompare(b.entry));
}

async function build(input_path, output_path, template) {
  console.log("Starting build");
  const summary = await fs.readFile(
    path.resolve(__dirname, "../src/SUMMARY.md"),
    "utf8"
  );

  for (const { entry, name } of await readdir_sorted(input_path)) {
    console.log(entry);
    await fs.mkdir(
      path.join(
        output_path,
        entry.substr(
          input_path.length,
          entry.length - input_path.length - name.length
        )
      ),
      { recursive: true }
    );
    const output_file_path = path.join(
      output_path,
      entry.substr(input_path.length)
    );

    entry.substr(-3) === ".md"
      ? fs.writeFile(
          output_file_path.slice(0, -3) + ".html",
          await build_page(entry, { template, summary }),
          "utf8"
        )
      : fs.copyFile(entry, output_file_path);
    if (name === "title-page.md")
      fs.writeFile(
        path.join(output_path, "index.html"),
        await build_page(entry, { template, summary }),
        "utf8"
      );
  }
  console.log("Linking chapters");
  const chapter_files = (await readdir_sorted(output_path)).filter((d) =>
    d.name.match(/^ch[0-9]+-[0-9]+-[\S]+\.html$/)
  );
  chapter_files.forEach(async ({ entry }, index) => {
    const [prev, next] = [chapter_files[index - 1], chapter_files[index + 1]];
    if (prev || next)
      fs.writeFile(
        entry,
        await link_page(entry, prev && prev.name, next && next.name),
        "utf8"
      );
  });
  const repl_file = path.join(output_path, "repl/clarity_repl_bg.wasm");
  let repl_exists = false;
  try {
    repl_exists = (await fs.stat(repl_file)).code !== "ENOENT";
  } catch (error) {}
  // if (!repl_exists)
  // 	{
  // 	console.log(`Downloading REPL WASM from ${repl_binary_url}`);
  // 	await fs.mkdir(path.join(output_path,'repl'));
  // 	fs.writeFile(repl_file,Buffer.from(await (await fetch(repl_binary_url)).arrayBuffer()));
  // 	}
}

fs.readFile(path.resolve(__dirname, "../templates/base.html"), "utf8").then(
  (template) => build(input_path, output_path, template)
);

fs.copyFile(
  path.resolve(
    __dirname,
    "../node_modules/@hirosystems/clarinet-sdk-wasm-browser/clarinet_sdk_bg.wasm"
  ),
  path.resolve(__dirname, "../build/clarinet_sdk_bg.wasm")
);
