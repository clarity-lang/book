## Constants

Constants are data members that cannot be changed once they are defined (hence
the name _constant_). They are useful to define concrete configuration values,
error codes, and more. The general form to define a constant looks like this:

```Clarity,{"nonplayable":true}
(define-constant constant-name expression)
```

The `constant-name` can be any valid phrase and the `expression` any valid
Clarity code.

The expression passed into the definition is evaluated at contract launch in the
order that it is supplied. If one constant thus depends on another, they need to
be defined in the right order.

```Clarity
(define-constant my-constant "This is a constant value")

(define-constant my-second-constant
	(concat my-constant " that depends on another")
)

(print my-constant)
(print my-second-constant)
```

A common pattern that you will come across is that of defining a constant to
store the principal that deployed the contract:

```Clarity
(define-constant contract-owner tx-sender)

(print contract-owner)
```

Constants are also useful to give return values and errors meaningful names.

```Clarity
(define-constant err-something-failed (err u100))

;; And then use err-something-failed instead of (err u100) later in the code.
(print err-something-failed)
```

If you are curious about the `print` function by this point: it allows us to
print something to the screen in the REPL. Interestingly enough, `print`
actually triggers a custom event and can be used to emit any valid data
structure. Custom applications scanning the chain could pick these events up and
process them further. The Stacks genesis block contains a
[simple smart contract](https://explorer.stacks.co/txid/0xa57c1b5e787712d833a330647e3efee17f6bb24de48044ea44c10fdf4f82ef23?chain=mainnet)
with a `print` expression to encode a nice message on the blockchain until the
end of time:

> ... to be a completely separate network and separate block chain, yet share
> CPU power with Bitcoin`` - Satoshi Nakamoto

The `print` function is used throughout the book to be able to show intermediary
values.
