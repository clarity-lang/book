## Implementing traits

Trait conformance is just a fancy way of saying that a specific smart contract
implements the functions defined in the trait. Take the following example trait:

```Clarity,{"nonplayable":true}
(define-trait multiplier
	(
		(multiply (uint uint) (response uint uint))
	)
)
```

If we want to implement the trait, all we have to do is make sure that our
contract contains a function `multiply` that takes two `uint` parameters and
returns a response that is either a `(ok uint)` or `(err uint)`. The following
contract will do just that:

```Clarity
(define-read-only (multiply (a uint) (b uint))
	(ok (* a b))
)

(define-read-only (divide (a uint) (b uint))
	(ok (/ a b))
)
```

Notice how the contract has another function `divide` that is not present in the
`multiplier` trait. That is completely fine because any system that is looking
for contracts that implement `multiplier` do not care what other functions those
contracts might implement. Reliance on the trait ensures that conforming
contracts have a compatible `multiply` function implementation, nothing more.

### Asserting trait implementations

In the opening paragraph of this chapter we talked about implicit and explicit
conformity. Under normal circumstances you always want to explicitly assert that
your contract implements a trait.

Imagine that the `multiplier` trait is deployed in a contract called
`multiplier-trait` by the same principal. To assert that the example contract
implements the trait, the `impl-trait` function is used.

```Clarity,{"nonplayable":true}
(impl-trait .multiplier-trait.multiplier)
```

By adding this expression, the analyser will check if the contract implements
the trait specified when the contract is deployed. It will reject the
transaction if the contract is not a full implementation. It is therefore
recommended to always use `impl-trait` because it prevent accidental
non-conformity.

The `impl-trait` function takes a single _trait reference_ parameter. A trait
reference is a [contract principal](ch02-01-primitive-types.md#principals) plus
the name of the trait. Trait references can be written in short form as seen
above, or as a fully qualified reference.

```Clarity,{"nonplayable":true}
(impl-trait 'ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.multiplier-trait.multiplier)
```

The introduction mentioned Clarity favours
[composition over inheritance](ch00-00-introduction.md#composition-over-inheritance).
Smart contracts can implement multiple traits, leading to more complex composite
behaviour when required. For example, say that there also exists a `divider`
trait that describes the `divide` function, deployed in another contract called
`divider-trait`.

```Clarity,{"nonplayable":true}
(define-trait divider
	(
		(divide (uint uint) (response uint uint))
	)
)
```

A contract that implements both traits simply contains multiple `impl-trait`
expressions.

```Clarity,{"nonplayable":true}
(impl-trait .multiplier-trait.multiplier)
(impl-trait .divider-trait.divider)
```

### Contract relations in Clarinet

Testing whether your contract fully implements a trait by deploying it on-chain
is not very economical. Clarinet has the ability to check trait implementations
to make development easier and safer. Each contract has its own section inside
the `Clarinet.toml` configuration file. The property `depends_on` contains a
list of _contract names_—not principals—that a given contract depends on.

```toml
[contracts.math-utilities]
path = "contracts/math-utilities.clar"
depends_on = ["multiplier-trait", "divider-trait"]
```

Clarinet resolves the dependency graph based on the various `depends_on`
properties to deploy the contracts in the right order. In the case above, the
`math-utilities` contract depends on two contracts called `multiplier-trait` and
`divider-trait`.
