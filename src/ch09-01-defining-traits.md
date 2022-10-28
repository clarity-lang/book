## Defining traits

Traits are defined using the `define-trait` function. It takes a trait name as a
parameter followed by a series of function signatures in short form. The
function signatures looks a bit different from those defining a
[custom function](ch05-00-functions.md) in that they only contain the name,
input types, and output types. Function argument names are not included because
they are not important in terms of functionality. Think about it, when performing 
a contract call, you pass a list of parameters and never specify the argument
names themselves. Only the order and types are important.

The general form for defining a trait looks like this:

```Clarity,{"nonplayable":true}
(define-trait my-trait
	(
		(function-name-1 (param-types-1) response-type-1)
		(function-name-2 (param-types-2) response-type-2)
		;; And so on...
	)
)
```

### Time-locked wallet trait

Earlier, we created a
[time-locked wallet contract](ch08-01-time-locked-wallet.md) that allows someone
to lock a number of tokens until a certain block height is reached. We can
define a trait for it, allowing us to standardise the interface.

```Clarity,{"nonplayable":true}
(define-trait locked-wallet-trait
	(
		(lock (principal uint uint) (response bool uint))
		(bestow (principal) (response bool uint))
		(claim () (response bool uint))
	)
)
```

Once this trait is deployed on-chain, future contracts can point to it to
_implement_ the trait.
