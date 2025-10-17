## Composite types

These are more complex types that contain a number of other types. Composites
make it a lot easier to create larger smart contracts.

### Optionals

The type system in Clarity does not allow for empty values. It means that a
boolean is always either `true` or `false`, and an integer always contains a
number. But sometimes you want to be able to express a variable that could have
_some_ value, or _nothing_. For this you use the `optional` type. This type
wraps a different type and can either be `none` or a value of that type. The
optional type is very powerful and the tooling will perform checks to make sure
they are handled properly in the code. Let us look at a few examples.

Wrapping a `uint`:

```Clarity
(some u5)
```

An ASCII string:

```Clarity
(some "An optional containing a string.")
```

Or even a principal:

```Clarity
(some 'ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE)
```

_Nothing_ is represented by the keyword `none`:

```Clarity
none
```

Functions that might or might not return a value tend to return an optional
type. As we saw in the previous section, both `element-at` and `index-of`
returned a `(some ...)`. It is because for some inputs, no matching value can be
found. We can take the same list but this time try to retrieve an element at an
index _larger_ than the total size of the list. We see that it results in a
`none` value.

```Clarity
(element-at? (list 4 8 15 16 23 42) u5000)
```

When writing smart contracts, the developer must handle cases where `(some ...)`
is returned differently from when `none` is returned.

In order to access the value contained within an optional, you have to _unwrap_
it.

```Clarity
(unwrap-panic (some u10))
```

Trying to unwrap a `none` will result in an error because there is nothing to
unwrap. The _"panic"_ in `unwrap-panic` should give that away. (We use a trick with
`if` to provide information about the type of the optional value, otherwise Clarity can't
handle the expression.)

```Clarity
(unwrap-panic (if true none (some u10)))
```

Later chapters on error handling and defining custom functions will dive into
how to deal with such errors and what effects they have on the chain state.

### Tuples

Tuples are records that hold multiple values in named fields. Each field has its
own type, making it very useful to pass along structured data in one go. Tuples
have their own special formatting and use curly braces.

```Clarity
{
	id: u5, ;; a uint
	username: "ClarityIsAwesome", ;; an ASCII string
	address: 'ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE ;; and a principal
}
```

The members inside tuples are unordered. You retrieve them by name and cannot
iterate over them. A specific member can be read using the `get` function.

```Clarity
(get username { id: 5, username: "ClarityIsAwesome" })
```

Tuples, like other values, are immutable once defined. It means that they cannot
be changed. You can, however, merge two tuples together to form a new tuple.
Merging is done from left to right and will overwrite values with the same key.

```Clarity
(merge
	{id: 5, score: 10, username: "ClarityIsAwesome"}
	{score: 20, winner: true}
)
```

The above expression will result in a tuple with both keys merged and the score
set to `20`.

Since the merge function returns an _entirely new_ tuple, member types can in
fact be overwritten by a later tuple in the sequence.

```Clarity
(merge
	{id: u6, score: 10}
	{score: u50}
)
```

### Responses

A response is a composite type that wraps another type just like an optional.
What is different, however, is that a response type includes an indication of
whether a specific action was successful or a failure. Responses have special
effects when returned by public functions. We will cover those effects in the
[chapter on functions](ch04-01-public-functions.md).

A response takes the concrete form of either `(ok ...)` or `(err ...)`. Wrapping
a value in a concrete response is straightforward:

```Clarity
(ok true)
```

Developers usually come up with their own rules to indicate error status. You
could for example use unsigned integers to represent a specific error code.

```Clarity
(err u5) ;; something went wrong.
```

There are no explicit rules on which types you should wrap for your responses.
Standards are currently being proposed and we will touch upon a few in the
chapter on _Stacks Improvement Proposals_ (SIPs).

Responses can be unwrapped in the same way as optional types:

```Clarity
(unwrap-panic (ok true))
```

Although not necessary, private functions and read-only functions may also
return a response type.
