## Response checking

We already learned that the
[response returned by a public function](ch05-01-public-functions.md) determines
whether or not a state change materialises on the chain. This does not just hold
true for the initial contract call, but also for subsequent calls. If a standard
principal calls into _Contract A_, which in turn calls into _Contract B_, then
the response of _Contract B_ will only influence the internal state of _Contract
B_. That is to say, if _Contract B_ returns an `err`, then any modifications to
its own data members are reverted, but _Contract A_ can still modify its own
data members and have those materialise if it returns an `ok` itself. However,
the first contract in the call remains in ultimate control. If it returns an
`err` then anything down the line will not materialise.

**Committing or reverting changes is therefore determined sequentially.**

It means that in a multi-contract call chain, the calling contract knows with
absolute certainty that a sub call will not materialise on chain if it returns
an `err` response. Nonetheless, a contract may depend on the success of the sub
contract call. For example, a wallet contract is calling into a token contract
to transfer a token. It happens all too often that developers forget to check
the return value. To protect against such mistakes, Clarity forbids intermediary
responses to be left unchecked. An intermediary response is a response that,
while part of an expression, is not the one that is returned. We can illustrate
it with the `begin` function:

```Clarity
(begin
	true        ;; this is a boolean, so it is fine.
	(err false) ;; this is an *intermediary response*.
	(ok true)   ;; this is the response returned by the begin.
)
```

Executing the snippet returns the following error:

> Analysis error: intermediary responses in consecutive statements must be
> checked

Since responses are meant to indicate the success or failure of an action, they
cannot be left dangling. _Checking_ the response simply means dealing with it;
that is, unwrapping it or propagating it. We can therefore put a `try!` or
another control flow function around it to fix the code.

Any function call that returns a response must either be returned by the calling
function or checked. Usually, this takes the form of an inter-contract function
call, but some built-in functions also return a response type. The
`stx-transfer?` function is one of them.

We will see what this behaviour looks like with the following deposit contract.
It contains a function that allows a user to deposit STX and will track
individual user deposits. The function is invalid due to an unchecked
intermediary response. Your challenge is to _try_ to locate and fix it.

```Clarity,{"setup":["::mint_stx ST000000000000000000002AMW42H 10000000"]}
(define-map deposits principal uint)

(define-read-only (get-total-deposit (who principal))
	(default-to u0 (map-get? deposits who))
)

(define-public (deposit (amount uint))
	(begin
		(stx-transfer? amount tx-sender (as-contract tx-sender))
		(map-set deposits tx-sender (+ (get-total-deposit tx-sender) amount))
		(ok true)
	)
)

;; Try a test deposit
(print (deposit u500))
```

Did you figure it out? Analysis gives us a hint, indicating that the `begin`
expression contains an intermediary response. In this case, it is the return
value of `stx-transfer?`. The easiest way to check the response is by simply
wrapping the transfer in a `try!`. That way, the result of the transfer is
unwrapped if it is successful, and propagated if it is an `err`. We thus rewrite
the line as follows:

```Clarity,{"nonplayable":true}
(try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
```

We could have also solved the issue by unwrapping the response and using
conditional statements. However, such a structure would have made the function a
lot more convoluted and would honestly overcomplicate things. The art of writing
smart contracts is coming up with a straightforward application flow, achieving
the desired functionality in the least amount of code.

The new function looks nice, but it is actually possible to simplify the
function even more:

```Clarity,{"nonplayable":true}
(define-public (deposit (amount uint))
	(begin
		(map-set deposits tx-sender (+ (get-total-deposit tx-sender) amount))
		(stx-transfer? amount tx-sender (as-contract tx-sender))
	)
)
```

This implementation is functionally equivalent. `stx-transfer?` returns a
response of type `(response bool uint)`, we therefore do not need to reiterate
our own `(ok true)` at the end of the `begin`. By moving the transfer expression
to the last line, its response no longer intermediary and will be returned from
the `deposit` function—whether it is an `ok` or an `err`.

The chapter on [best practices](ch14-00-best-practices.md) will teach you some
techniques on how to spot code that can be simplified in the same manner.
