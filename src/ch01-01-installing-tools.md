## Installing the REPL and Clarinet

Both the REPL and Clarinet are experimental software. As such, installation
procedures may be updated often. It is therefore recommended to consult the
documentation of the tool in question in order to install it.

### Clarity REPL

A _read–eval–print loop_ (REPL) is an interactive computer programming
environment that takes user inputs, evaluates them, and returns the result to
the user. The Clarity REPL allows you to play around with the Clarity language
and evaluate different expressions. It is very useful for quick tests or to
verify the syntax of your code. The REPL is very versatile and can even be
packaged up as a web component to be used in the browser (a so called
[WASM binary](https://en.wikipedia.org/wiki/WebAssembly)). In fact, the
interactive snippets found throughout this book are made possible because of it!
If you are reading the book online you do not necessarily have to install the
REPL, but it is definitely nice to have.

Visit the official GitHub repository for the latest instructions on how to set
up the Clarity REPL on your system: https://github.com/hirosystems/clarity-repl.

### Clarinet

Clarinet is a Clarity runtime packaged as a command line tool, designed to make
it easy to write, test, and deploy Clarity smart contracts. Clarinet uses the
Clarity REPL under the hood. It is self-contained and provides a built-in
testing environment to write tests for your smart contracts. Clarinet is the
tool that will be used throughout this book. It will be the basis for all
upcoming example projects.

There are two ways to get Clarinet. The first way is to download one of the
_prebuilt binaries_ from the
[GitHub releases page](https://github.com/hirosystems/clarinet/releases/). You
will have to download the one particular to your platform, extract it, and then
move it to a folder where your command line interface can find it:

- **macOS & Linux**: copy the `clarinet` binary to `/usr/local/bin`.
- **Windows**: copy the `clarinet.exe` binary to `C:\Windows\System32`. (A
  better solution is in the works.)

You can verify Clarinet is installed properly by running `clarinet --version` in
your favourite Terminal emulator.

```bash
% clarinet --version
clarinet 0.24.0
```
