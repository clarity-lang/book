## try!

The `try!` function takes an `optional` or a `response` type and will attempt to
_unwrap_ it. Unwrapping is the act of extracting the inner value and returning
it. Take the following example:

```Clarity
(try! (some "wrapped string"))
```

It will unwrap the `some` and return the inner `"wrapped string"`.

`try!` can only successfully unwrap `some` and `ok` values. If it receives a
`none` or an `err`, it will return the input value and exit the current control
flow. In other words:

- If it receives a `none`, it returns a `none` and exits.
- If it receives an `err`, it returns that `err` and exits. It _does not_ unwrap
  the value inside!

The following test function allows us to experiment with this behaviour. It
takes a response type as input which is passed to `try!`. We will then call the
function with an `ok` and an `err` and print the results.

```Clarity
(define-public (try-example (input (response uint uint)))
	(begin
		(try! input)
		(ok "end of the function")
	)
)

(print (try-example (ok u1)))
(print (try-example (err u2)))
```

The first print gives us the `(ok "end of the function")` as seen at the end of
the `begin` expression. But the second call that passes the `err` gives us back
the original `(err u2)`. The `try!` function therefore allows you to _propagate_
an error that occurs in a sub call, as we will see in the section on
[intermediary responses](ch06-04-response-checking.md).
