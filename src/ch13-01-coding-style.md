## Coding style

Here are some suggestions on Clarity coding style. The chapter is intentionally
not called _coding guidelines:_ the community leads the way. If coding style
SIPs are ever ratified then they shall be covered here. Until then we can only
make a best effort based on the experiences of long-time developers.

### Pointless begins

Most functions take an invariant amount of inputs. Some developers therefore
develop a tendency to overuse `begin`. If your `begin` only contains one
expression, then you can remove it!

```Clarity,{"nonplayable":true}
(define-public (get-listing (id uint))
	(begin
		(ok (map-get? listings {id: id}))
	)
)
```

And without:

```Clarity,{"nonplayable":true}
(define-public (get-listing (id uint))
	(ok (map-get? listings {id: id}))
)
```

There actually is a [runtime cost](ch12-00-runtime-cost-analysis.md) attached to
`begin`, so leaving it out makes your contract call cheaper. The same goes for
`begin` inside other invariant function expressions.

```Clarity,{"nonplayable":true}
>> ::get_costs (+ 1 2)
+----------------------+----------+------------+
|                      | Consumed | Limit      |
+----------------------+----------+------------+
| Runtime              | 4000     | 5000000000 |
+----------------------+----------+------------+
3

>> ::get_costs (begin (+ 1 2))
+----------------------+----------+------------+
|                      | Consumed | Limit      |
+----------------------+----------+------------+
| Runtime              | 6000     | 5000000000 |
+----------------------+----------+------------+
3
```

### Nested lets

The `let` function allows us to define local variables. It is useful if you
would otherwise have to read data or redo a calculation multiple times. Variable
expressions are actually evaluated in sequence which means that a later variable
expression can refer to prior expressions. There is therefore no need to nest
multiple `let` expressions if all you want to do is calculate a value based on
some prior variables.

```Clarity,{"nonplayable":true}
(let
	(
    (value-a u10)
    (value-b u20)
    (result (* value-a value-b))
	)
	(ok result)
)
```

### Avoid \*-panic functions

There are multiple ways to unwrap values, but `unwrap-panic` and
`unwrap-err-panic` should generally be avoided. They abort the call with a
runtime error if they fail to unwrap the supplied value. A runtime error does
not give any meaningful information to the application calling the contract and
makes error handling more difficult. Whenever possible, use `unwrap!` and
`unwrap-err!` with a meaningful error code.

Compare the functions `update-name` and `update-name-panic` in the example
below.

```Clarity,{"nonplayable":true}
(define-public (update-name (id uint) (new-name (string-ascii 50)))
	(let
		(
			;; Emits an error value when the unwrap fails.
			(listing (unwrap! (get-listing id) err-unknown-listing))
		)
		(asserts! (is-eq contract-caller (get maker listing)) err-not-the-maker)
		(map-set listings {id: id} (merge listing {name: new-name}))
		(ok true)
	)
)

(define-public (update-name-panic (id uint) (new-name (string-ascii 50)))
	(let
		(
			;; No meaningful error code is emitted if the unwrap fails.
			(listing (unwrap-panic (get-listing id)))
		)
		(asserts! (is-eq contract-caller (get maker listing)) err-not-the-maker)
		(map-set listings {id: id} (merge listing {name: new-name}))
		(ok true)
	)
)
```

It is best to restrict the use of `unwrap-panic` and `unwrap-err-panic` to
instances where you already know beforehand that the unwrapping should not fail.
(Because of a prior guard, for example.)

### Avoid the if function

To be honest, you should not actually avoid using the `if` function. But anytime
you use it, ask yourself if you do really need it. Quite often, you can refactor
the code and replace it with `asserts!` or `try!`. New developers often end up
creating nested `if` structures because they need to check multiple conditions
in sequence. Those structures become extremely hard to follow and are prone to
error.

For example:

```Clarity,{"nonplayable":true}
(define-public (update-name (new-name (string-ascii 50)))
	(if (is-eq contract-caller contract-owner)
		(ok (var-set contract-name new-name))
		err-not-contract-owner
	)
)
```

Can be rewritten to:

```Clarity,{"nonplayable":true}
(define-public (update-name (new-name (string-ascii 50)))
	(begin
		(asserts! (is-eq contract-caller contract-owner) err-not-contract-owner)
		(ok (var-set contract-name new-name))
	)
)
```

Multiply nested `if` expressions can usually be rewritten this way. Just compare
this:

```Clarity,{"nonplayable":true}
(define-public (some-function)
	(if bool-expr-A
		(if bool-expr-B
			(if bool-expr-C
				(ok (process-something))
				if-C-false
			)
			if-B-false
		)
		if-A-false
	)
)
```

To this:

```Clarity,{"nonplayable":true}
(define-public (some-function)
	(begin
		(asserts! bool-expr-A if-A-false)
		(asserts! bool-expr-B if-B-false)
		(asserts! bool-expr-C if-C-false)
		(ok (process-something))
	)
)
```

### To match or not to match

`match` is a really powerful function, but a `try!` is sufficient in many cases.
A commonly observed pattern is as follows:

```Clarity,{"nonplayable":true}
(match (some-expression)
	success (ok success)
	error (err error)
)
```

For which the functionally equivalent simplification is nothing more than the
function call itself:

```Clarity,{"nonplayable":true}
(some-expression)
```

`match` unwraps the result of a `response` and enters either the success or
failure branch with the unwrapped `ok` or `err` value. Immediately returning
those values is therefore pointless.

Here is a real transfer function found in a mainnet contract:

```Clarity,{"nonplayable":true}
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
	(if (and (is-eq contract-caller sender))
		(match (nft-transfer? my-nft token-id sender recipient)
			success (ok success)
			error (err error))
		(err u500)
	)
)
```

Refactoring the `if` and `match`, we are left with just this:

```Clarity,{"nonplayable":true}
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
	(begin
		(asserts! (is-eq contract-caller sender) (err u500))
		(nft-transfer? my-nft token-id sender recipient)
	)
)
```
