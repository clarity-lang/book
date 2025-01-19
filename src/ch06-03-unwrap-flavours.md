## Unwrap flavours

The other unwrap functions are all variations that exit the current control flow
in a slightly different manner.

`unwrap!` takes an `optional` or `response` as the first input and a throw value
as the second input. It follows the same unwrapping behaviour of `try!` , but
instead of propagating the `none` or the `err` it will return the the throw
value instead.

```Clarity
(unwrap! (some "wrapped string") (err "unwrap failed"))
```

`unwrap-panic` takes a single input which is either an `optional` or `response`.
If it fails to unwrap the input, it throws a runtime error and exits the current
flow.

```Clarity
(unwrap-panic (ok true))
```

`unwrap-err!` takes a `response` input and a throw value. If the first input is
an `err`, it will return the wrapped value. Otherwise it returns the throw value
and exit. It is the counterpart to `unwrap!`.

```Clarity
(unwrap-err! (err false) (err "unwrap failed"))
```

`unwrap-err-panic` is the counterpart to `unwrap-panic`, the input is unwrapped
if it is an `err`, or else a runtime error is thrown.

```Clarity
(unwrap-err-panic (err false))
```

You should ideally not use the `-panic` variants unless you absolutely have to,
because they confer no meaningful information when they fail. A transaction will
revert with a vague "runtime error" and users as well as developers are left to
figure out exactly what went wrong.

### Unpacking assignments

The unwrap functions are particularly useful when assigning local variables
using `let`. You can unwrap and assign a value if it exists or exit if it does
not. It makes working with [maps](ch04-03-maps.md) and
[lists](ch02-02-sequence-types.md#lists) a breeze.

```Clarity
;; Some error constants
(define-constant err-unknown-listing (err u100))
(define-constant err-not-the-maker (err u101))

;; Define an example map called listings, identified by a uint.
(define-map listings
	{id: uint}
	{name: (string-ascii 50), maker: principal}
)

;; Insert some sample data
(map-set listings {id: u1} {name: "First Listing", maker: tx-sender})
(map-set listings {id: u2} {name: "Second Listing", maker: tx-sender})

;; Simple function to get a listing
(define-read-only (get-listing (id uint))
	(map-get? listings {id: id})
)

;; Update name function that only the maker for a specific listing
;; can call.
(define-public (update-name (id uint) (new-name (string-ascii 50)))
	(let
		(
			;; The magic happens here.
			(listing (unwrap! (get-listing id) err-unknown-listing))
		)
		(asserts! (is-eq contract-caller (get maker listing)) err-not-the-maker)
		(map-set listings {id: id} (merge listing {name: new-name}))
		(ok true)
	)
)

;; Two test calls
(print (update-name u1 "New name!"))
(print (update-name u9999 "Nonexistent listing..."))
```

Find the comment `;; The magic happens here.` inside the `update-name` function
and study the next line closely. Here is what happens:

- It defines a variable called `listing`.
- The value will be equal to the _unwrapped result_ of the `get-listing`
  function.
- `get-listing` returns the result of `map-get?`, which is either `some` listing
  or `none`.
- If the unwrap fails, `unwap!` exits with `err-unknown-listing`.

The first test call will therefore succeed and return `(ok true)` while the
second call will error out with `(err u100)` (`err-unknown-listing`).
