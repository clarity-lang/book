# Control flow & error handling

Errors, would it not be great if smart contracts were error free? Error handling
in Clarity follows a very straightforward paradigm. We have already seen that
returning an `err` from a [public function](ch05-01-public-functions.md)
triggers a revert. That is pretty significant, but understanding the _control
flow_ of your smart contract is even more important.

What is control flow? Put simply, it is the order in which expressions are
evaluated. The functions introduced up until this point allow follow a simple
left-to-right rule. `begin` perfectly illustrates this:

```Clarity
(begin
	(print "First")
	(print "Second")
	(print "Third")
)
```

The first print expression is evaluated first, the second after that, and so on.
But there are a few functions that actually influence the control flow. These
are aptly named _control flow functions_. If understanding
[responses](ch05-01-public-functions.md) is key to becoming a successful smart
contract developer, then understanding control functions is key to becoming a
great smart contract developer. The names of the control flow functions are:
`asserts!`, `try!`, `unwrap!`, `unwrap-err!`, `unwrap-panic`, and
`unwrap-err-panic`.

Up until now, we used `if` expressions to either return an `ok` or an `err`
response. Recall the return portion of the `count-even` function in the chapter
on [public function](ch05-01-public-functions.md):

```Clarity,{"nonplayable":true}
(if (is-eq (mod number u2) u0)
	(ok "the number is even")
	(err "the number is uneven")
)
```

One can argue that the structure is still decently legible, but imagine needing
multiple conditionals that all return a different error code on failure. You
will quickly end up with constructs that no sane developer can easily
understand! Control flow functions are absolutely necessary to produce legible
code once your contracts become more complex. They allow you to create
short-circuits that immediately return a value from a function, ending execution
early and thus skipping over any expressions that might have come after.
