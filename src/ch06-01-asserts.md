## asserts!

The `asserts!` function takes two parameters, the first being a boolean
expression and the second a so-called _throw value_. If the boolean expression
evaluates to `true`, then `asserts!` returns `true` and execution continues as
expected, but if the expression evaluates to `false` then `asserts!` will return
the throw value and _exit the current control flow_.

That sounds complicated, so let us take a look at some examples. Keep in mind
that the basic form for `asserts!` as described looks like this:

```Clarity,{"nonplayable":true}
(asserts! boolean-expression throw-value)
```

The following assertion is said to _pass_, as the boolean expression evaluates
to `true`.

```Clarity
(asserts! true (err "failed"))
```

The next one is said to _fail_, as the boolean expression evaluates to `false`.

```Clarity
(asserts! false (err "failed"))
```

Notice how somewhere in that error message we find the `(err "failed")`? Let us
make it more clear with a test function. The test function takes a boolean input
value and asserts its truthiness. For a throw value we will use an `err` and the
final expression will return an `ok`.

```Clarity
(define-public (asserts-example (input bool))
	(begin
		(asserts! input (err "the assertion failed"))
		(ok "end of the function")
	)
)

(print (asserts-example true))
(print (asserts-example false))
```

The first print gives us the `ok` as seen at the end of the `begin` expression.
Nothing too strange there. But the second call gives us the `err` throw value!

Even though the `begin` function gives us the result of the final expression
_under normal circumstances_, the `asserts!` control function has the ability to
_override that behaviour and exit the current flow_. When `asserts!` fails, it
short-circuits and returns the throw value from the function immediately. It
makes `asserts!` really useful for creating guards by _asserting_—hence the
name—that certain values are what you expect them to be.

Remember that `is-valid-caller` function in the
[chapter on private functions](ch05-02-private-functions.md)? The example used
an `if` function to only allow the action if the `contract-caller` was equal to the
principal that deployed the contract. Let us now rewrite that contract to use
`asserts!` instead:

```Clarity
(define-constant contract-owner tx-sender)

;; Try removing the contract-owner constant above and using a different
;; one to see the example calls error out:
;; (define-constant contract-owner 'ST20ATRN26N9P05V2F1RHFRV24X8C8M3W54E427B2)

(define-constant err-invalid-caller (err u1))

(define-map recipients principal uint)

(define-private (is-valid-caller)
	(is-eq contract-owner contract-caller)
)

(define-public (add-recipient (recipient principal) (amount uint))
	(begin
		;; Assert the contract-caller is valid.
		(asserts! (is-valid-caller) err-invalid-caller)
		(ok (map-set recipients recipient amount))
	)
)

(define-public (delete-recipient (recipient principal))
	(begin
		;; Assert the contract-caller is valid.
		(asserts! (is-valid-caller) err-invalid-caller)
		(ok (map-delete recipients recipient))
	)
)

;; Two example calls to the public functions:
(print (add-recipient 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK u500))
(print (delete-recipient 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK))
```

That looks a lot more readable. If you disagree, wait until you get to the
chapter on best practices.
