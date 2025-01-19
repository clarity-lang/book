# Introduction

_Clarity of Mind_ is both an introductory as well as a reference book for the
Clarity smart contract language. Clarity is developed as a joint effort of
[Hiro PBC](https://hiro.so), [Algorand](http://algorand.com), and various other
stakeholders, that originally targets the Stacks blockchain. A significant
innovation in the field of smart contract development, Clarity allows you to
write more safe and secure smart contracts. The language optimises for
readability and predictability and is purpose-built for developers working
applications with high-stakes transactions.

## Target audience

This book is accessible for both beginners and experienced developers alike.
Concepts are gradually introduced in a logical and steady pace. Nonetheless, the
chapters lend themselves rather well to being read in a different order. More
experienced developers might get the most benefit by jumping to the chapters
that interest them most. **If you like to learn by example, then you should go
straight to the [chapter on Using Clarinet](ch07-00-using-clarinet.md).**

It is assumed that you have a basic understanding of programming and the
underlying logical concepts. The first chapter covers the general syntax of
Clarity but it does not delve into what programming _itself_ is all about. If
this is what you are looking for, then you might have a more difficult time
working through this book unless you have an (undiscovered) natural affinity for
such topics. Do not let that dissuade you though, find an introductory
programming book and press on! The straightforward design of Clarity makes it a
great first language to pick up.

## What are smart contracts & blockchains?

Clarity is a language for writing _smart contracts_ that run on a _blockchain_.
Before we can discuss the what smart contracts are, we must understand what a
blockchain is. There is a wealth of information available on the topic, as well
as what different kinds of blockchains exist. We will therefore only briefly
touch upon the concept in a more generalised sense. A blockchain can be thought
of as a special kind of _immutable distributed database_:

- It is _distributed_ in the sense that all participants can get a complete copy
  of the database. Once you install a Bitcoin node, for example, it will start
  downloading the entire blockchain from the network. There is no single party
  that hosts or manages the entire blockchain on behalf of the users. Everyone
  that plays by the rules can participate in the network.

- _Immutability_ comes from the fact that once information is added, it cannot
  (feasibly[^1]) be changed. The network rules prevent any one actor from making
  changes to data that has already been inserted. Blockchains are unique in that
  they leverage cryptography to ensure that all participants reach a consensus
  on the true state of the data. It allows the network to function without the
  need of trusting a central authority and it is why it is referred to as a
  "trustless system". It is where the "crypto" in "cryptocurrency" comes from.

The blockchain is therefore a kind of secure and resilient public record.
Changes are made by submitting a properly formatted and digitally signed
_transaction_ onto the network. The different nodes in the network collect these
transactions, assess their validity, and will then include them in the next
block based on some conditions. For most blockchains, the nodes that create
blocks are reimbursed by the transaction senders. Transactions come attached
with a small fee that the node can claim when it includes the transaction in a
block.

Smart contracts are programs that run on top of blockchains and can utilise
their unique properties. Effectively, it means that you can build an application
that does not run on a single system but is instead executed and verified across
a distributed network. The same nodes that process transactions will execute the
smart contract code and include the result in the next block. Users can _deploy_
smart contracts—the act of adding a new one to the chain—and call into existing
ones by sending a transaction. Because executing some code is more resource
intensive, the transaction fee will go up depending on the complexity of the
code.

## What makes Clarity different

The number of smart contract languages grows by the year. Choosing a first
language can be challenging, especially for a beginner. The choice is largely
dictated by the ecosystem you are interested in, although some languages are
applicable to more than just one platform. Each language has its own upsides and
downsides and it is out of the scope of this book to look at all of them.
Instead, we will focus on what sets Clarity apart and why it is a prime choice
if you require the utmost security and transparency.

One of the core precepts of Clarity is that it is secure by design. The design
process was guided by examining common pitfalls, mistakes, and vulnerabilities
in the field of smart contract engineering as a whole. There are countless real
world examples of where developer failure led to the loss or theft of vast
amounts of tokens. To name two big ones: an issue that has become known as the
_Parity bug_ led to the irreparable loss of millions of dollars worth of
Ethereum. Second, the hacking of The DAO (a _"Decentralised Autonomous
Organisation"_) caused financial damage so great that the Ethereum Foundation
decided to issue a contentious hard fork that undid the theft. These and many
other mistakes could have been prevented in the design of the language itself.

### Clarity is _interpreted_, not _compiled_

Clarity code is interpreted and committed to the chain exactly as written.
Solidity and other languages are compiled to byte-code before it is submitted to
the chain. The danger of compiled smart contract languages is two-fold: first, a
compiler adds a layer of complexity. A bug in the compiler may lead to different
byte-code than was intended and thus carries the risk of introducing a
vulnerability. Second, byte-code is not human-readable, which makes it very hard
to verify what the smart contract is actually doing. Ask yourself, _would you
sign a contract you cannot read?_ If your answer is no, then why should it be
any different for smart contracts?[^2] With Clarity, what you see is what you
get.

### Clarity is _decidable_

A decidable language has the property that from the code itself, you can know
with certainty what the program will do. This avoids issues like the
[halting problem](https://en.wikipedia.org/wiki/Halting_problem). With Clarity
you know for sure that given any input, the program will halt in a finite number
of steps. In simple terms: it is guaranteed that program execution will end.
Decidability also allows for complete static analysis of the call graph so you
get an accurate picture of the exact cost before execution. There is no way for
a Clarity call to _"run out of gas"_ in the middle of the call. If you are
unsure what this means, let it not worry you for now. The serious advantage of
decidability will become more apparent over time.

### Clarity does not permit _reentrancy_

Reentrancy is a situation where one smart contract calls into another, which
then calls back into the first contract—the call _"re-enters"_ the same logic.
It may allow an attacker to trigger multiple token withdrawals before the
contract has had a chance to update its internal balance sheet. Clarity's design
considers reentrancy an anti-feature and disallows it on the language level.

### Clarity guards against _overflow_ and _underflows_

Overflows and underflows happen when a calculation results in a number that is
either too large or too small to be stored, respectively. These events throw
smart contracts into disarray and may intentionally be triggered in poorly
written contracts by attackers. Usually this leads to a situation where the
contract is either frozen or drained of tokens. Overflows and underflows of any
kind automatically cause a transaction to be aborted in Clarity.

### Support for custom tokens is built-in

Issuance of custom fungible and non-fungible tokens is a popular use-case for
smart contracts. Custom token features are built into the Clarity language.
Developers do not need to worry about creating an internal balance sheet,
managing supply, and emitting token events. Creating custom tokens is covered in
depth in later chapters.

### On Stacks, transactions are secured by _post conditions_

In order to further safeguard user tokens, post conditions can be attached to
transactions to assert the chain state has changed in a certain way once the
transaction has completed. For example, a user calling into a smart contract may
attach a post condition that states that after the call completes, exactly 500
STX should have been transferred from one address to another. If the post
condition check fails, then the entire transaction is reverted. Since custom
token support is built right into Clarity, post conditions can also be used to
guard any other token in the same way.

### Returned responses cannot be left unchecked

Public contract calls must return a so-called _response_ that indicates success
or failure. Any contract that calls another contract is required to properly
handle the response. Clarity contracts that fail to do so are invalid and cannot
be deployed on the network. Other languages like Solidity permit the use of low
level calls without requiring the return value to be checked. For example, a
token transfer can fail silently if the developer forgets to check the result.
In Clarity it is not possible to ignore errors, although that obviously does
not prevent buggy error handling on behalf of the developer. Responses and error
handling are covered extensively in the chapters on
[functions](ch05-00-functions.md) and [control flow](ch06-00-control-flow.md).

### Composition over inheritance

Clarity adopts a composition over inheritance. It means that Clarity smart
contracts do not inherit from one another like you see in languages like
Solidity. Developers instead define traits which are then implemented by
different smart contracts. It allows contracts to conform to different
interfaces with greater flexibility. There is no need to worry about complex
class trees and contracts with implicit inherited behaviour.

### Access to the base chain: Bitcoin

Clarity smart contracts can read the state of the Bitcoin base chain. It means
you can use Bitcoin transactions as a trigger in your smart contracts! Clarity
also features a number of built-in functions to verify secp256k1 signatures and
recover keys.

[^1]: The note on feasibility was added for correctness. Blockchains are
designed to be highly resistant to change but there have been cases of rewrites.
Weaker chains can be susceptible to so-called "51% attacks" that allow a
powerful miner to rewrite that chain's history. On the other hand, influential
factions may mandate a node upgrade that changes chain history by means of a
hard fork. For example, the Ethereum Foundation "solved" the problem of the DAO
hack with a hard fork.

[^2]: Although this characteristic makes it a lot easier to read Clarity smart
contracts, it does not necessarily make it easy. A good grasp of Clarity is
still required, but one can argue that it is still a lot better than a
conventional paper contract written in legalese, which quite honestly can be
considered a language in its own right. The actual difference is that Clarity
permits only one interpretation, something that definitely cannot be said for
legalese.
