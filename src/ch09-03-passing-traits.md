## Passing traits as arguments

The [`contract-call?`](ch07-03-interacting-with-your-contract.md#contract-calls)
function allows contracts to call each other. Since the REPL and Clarinet start
an interactive Clarity session, we have also been using it to manually interact
with our contracts. The first two arguments are the _contract identifier_ and
the _function name_, followed by zero or more parameters. We learned that the
contract identifier can either be a short form or a fully qualified contract
principal. However, there is a third kind of contract identifier; namely, a
_trait reference_.

### Static dispatch

Up until now we have always been _hardcoding_ the contract identifier; that is
to say, we directly enter a contract principal as the first argument to
`contract-call?`. Remember our [smart-claimant](ch08-02-smart-claimant.md)? It
called into the time-locked wallet contract to claim the balance. Here is the
relevant snippet:

```Clarity,{"nonplayable":true}
(begin
    (try! (as-contract (contract-call? .timelocked-wallet claim)))
    (let ;; ...
```

The contract identifier `.timelocked-wallet` is invariant—it is hardcoded into
the contract. When the contract is deployed, the analyser will check if the
specified contract exists on-chain and whether it contains a public or read-only
function called `claim`. Contract calls with an invariant contract identifier
are said to dispatch _statically_.

### Dynamic dispatch

Traits enable us to pass contract identifiers as function arguments. It enables
_dynamic_ dispatch of contract calls, meaning that the actual contract called by
`contract-call?` depends on the initial call.

You can either define a trait in the same contract or import it using
`use-trait`. The latter allows you to bring a trait defined in another contract
to the current contract.

```Clarity,{"nonplayable":true}
(use-trait trait-alias trait-identifier)
```

The _trait identifier_ is the same as the one used in
[`impl-trait`](ch09-02-implementing-traits.md#asserting-trait-implementations).
The _trait alias_ defines the local name to use in the context of the current
contract.

If the locked-wallet trait we created in the
[previous section](ch09-01-defining-traits.md#time-locked-wallet-trait) were to
be deployed in a contract called `locked-wallet-trait`, then importing it with
an alias of the same name would look like this:

```Clarity,{"nonplayable":true}
(use-trait locked-wallet-trait 'ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.locked-wallet-trait.locked-wallet-trait)
```

(`locked-wallet-trait` is repeated because both the contract and the trait bear
the same name. Remember that a trait reference follows the pattern
`address.contract-name.trait-name`.)

Trait references in function arguments use their own notion. The trait alias as
a type is enclosed in angle brackets (`<` and `>`).

```Clarity,{"nonplayable":true}
(define-public (claim-wallet (wallet-contract <locked-wallet-trait>))
	(ok (try! (as-contract (contract-call? wallet-contract claim))))
)
```

The example `claim-wallet` function can then be called with a contract principal
that implements the `locked-wallet-trait` like so:

```Clarity,{"nonplayable":true}
(contract-call? .example-contract claim-wallet .timelocked-wallet)
```

The upcoming [marketplace practice project](ch11-00-building-a-marketplace.md)
contains practical examples of dynamically dispatching contract calls.
