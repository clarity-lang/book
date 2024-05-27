# Using Clarinet

The Clarinet workflow will be introduced by working through a series of example
projects. Since it is a command line tool, you need to have some familiarity
with _CLIs_ (_command-line interfaces_). Still, all commands will be carefully
explained so you can type along and take notes. Our IDE of choice is
[Visual Studio Code](https://code.visualstudio.com), an open source code editor
with a large following and tons of extensions to choose from. The official
Clarity language support extension is called
[Clarity for Visual Studio Code](https://marketplace.visualstudio.com/items?itemName=HiroSystems.clarity-lsp).
We suggest you install it alongside with the
[Rainbow Brackets extension](https://marketplace.visualstudio.com/items?itemName=2gua.rainbow-brackets)
for the best experience.

The chapters focusing on projects contain a good amount of screenshots and step
by step explanations to make it easy to follow for beginning developers and
people who are new to using Visual Studio Code itself. Full project source files
are also made available on GitHub. The link can be found at the end of each
chapter and in the [links and resources](ch14-00-links-and-resources.md) section.

From this point, it is assumed that you already successfully installed Clarinet
and that it is available in your system PATH (that is to say, typing `clarinet`
in your Terminal emulator runs Clarinet). If you do not yet have it installed,
head over to the introductory chapter on
[installing tools](ch01-01-installing-tools.md). You can verify Clarinet is
installed properly by running `clarinet --version` in your favourite Terminal
emulator.

```bash
% clarinet --version
clarinet-cli 2.6.0
```
