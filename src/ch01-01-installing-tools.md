## Installing Clarinet

### What is Clarinet?
Clarinet is a Clarity runtime packaged as a command line tool, designed to facilitate smart contract understanding, development, testing and deployment. Clarinet consists of a Clarity REPL and a testing harness, which, when used together allow you to rapidly develop and test a Clarity smart contract, with the need to deploy the contract to a local devnet or testnet.

Clarity is a decidable smart contract language that optimises for predictability and security, designed for the Stacks blockchain. Smart contracts allow developers to encode essential business logic on a blockchain.

### Install on macOS (Homebrew)
This process relies on the macOS package manager called [Homebrew](https://brew.sh/). Using the `brew` command you can easily add powerful functionality to your mac, but first we have to install it.

To get started, launch your [Terminal](https://support.apple.com/en-ph/guide/terminal/welcome/mac) (/Applications/Utilities/Terminal) application. Terminal is a versatile command line system that comes with every Mac computer.

If you do not already have [XCode](https://developer.apple.com/xcode/) installed, it's best to first install the command line tools as these will be used by homebrew:
```bash
xcode-select --install
```

When the XCode is complete, proceed with Homebrew installation:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
```

Now you can test your installation to ensure you have installed brew correctly, simply type:
```bash
% brew --version
Homebrew 3.6.3
```

Finally, you can now install the Clarinet on your mac:
```bash
brew install clarinet
```
Just follow the terminal prompts if necessary.

### Install on Windows

The easiest way to install Clarinet on Windows is to use the MSI installer, that can be downloaded from the [releases page](https://github.com/hirosystems/clarinet/releases).

Clarinet is also available on Winget, the package manager that Microsoft started including in the latest Windows updates:

```powershell
winget install clarinet
```

### Install from a pre-built binary

To install Clarinet from pre-built binaries, download the latest release from the [releases page](https://github.com/hirosystems/clarinet/releases).
Unzip the binary, then copy it to a location that is already in your path, such as `/usr/local/bin`.

```sh
# note: you can change the v0.27.0 with version that are available in the releases page.
wget -nv https://github.com/hirosystems/clarinet/releases/download/v0.27.0/clarinet-linux-x64-glibc.tar.gz -O clarinet-linux-x64.tar.gz
tar -xf clarinet-linux-x64.tar.gz
chmod +x ./clarinet
mv ./clarinet /usr/local/bin
```

On MacOS, you may get security errors when trying to run the pre-compiled binary. You can resolve the security warning
with this command:

```sh
xattr -d com.apple.quarantine /path/to/downloaded/clarinet/binary
```

### Install from source using Cargo

#### Prerequisites

[Install Rust](https://www.rust-lang.org/tools/install) for access to `cargo`, the Rust package manager.

On Debian and Ubuntu-based distributions, please install the following packages before building Clarinet.

```bash
sudo apt install build-essential pkg-config libssl-dev
```

#### Build Clarinet

You can build Clarinet from source using Cargo with the following commands:

```bash
git clone https://github.com/hirosystems/clarinet.git --recursive
cd clarinet
cargo clarinet-install
```

By default, you will be in our development branch, `develop`, with code that has not been released yet. If you plan to submit any changes to the code, then this is the right branch for you. If you just want the latest stable version, switch to the main branch:

```bash
git checkout main
```

If you have previously checked out the source, ensure you have the latest code (including submodules) before building using:

```bash
git pull
git submodule update --recursive
```

### Verify Clarinet installation

You can verify Clarinet is installed properly by running `clarinet --version` in
your favourite Terminal emulator.

```bash
% clarinet --version
clarinet-cli 1.0.2
```

More information about Clarinet: [https://github.com/hirosystems/clarinet/blob/develop/README.md](https://github.com/hirosystems/clarinet/blob/develop/README.md)
