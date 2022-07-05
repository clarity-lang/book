## Variables

Variables are data members that can be changed over time. They are only
modifiable by the current smart contract. Variables have a predefined type and
an initial value.

```Clarity,{"nonplayable":true}
(define-data-var var-name var-type initial-value)
```

Where the `var-type` is a _type signature_ and `initial-value` a valid value for
the specified type. Although you can name a variable pretty much anything, you
should be mindful of the [built-in keywords](ch03-00-keywords.md). Do not use
keywords as variable names.

Variables can be read using the function `var-get` and changed using `var-set`.

```Clarity
;; Define an unsigned integer data var with an initial value of u0.
(define-data-var my-number uint u0)

;; Print the initial value.
(print (var-get my-number))

;; Change the value.
(var-set my-number u5000)

;; Print the new value.
(print (var-get my-number))
```

Notice the `uint`? That is the type signature.

## Type signatures

The [chapter on types](ch02-00-types.md) covered how to express a value of a
specific type. Type signatures, on the other hand, define the admitted type for
a variable or function argument. Let us take a look at what the signatures look
like.

| Type                                                             | Signature                                                                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Signed integer](ch02-01-primitive-types.md#signed-integers)     | `int`                                                                                                                                                                    |
| [Unsigned integer](ch02-01-primitive-types.md#unsigned-integers) | `uint`                                                                                                                                                                   |
| [Boolean](ch02-01-primitive-types.md#booleans)                   | `bool`                                                                                                                                                                   |
| [Principal](ch02-01-primitive-types.md#principals)               | `principal`                                                                                                                                                              |
| [Buffer](ch02-02-sequence-types.md#buffers)                      | `(buff max-len)`, where `max-len` is a number defining the maximum length.                                                                                               |
| [ASCII string](ch02-02-sequence-types.md#strings)                | `(string-ascii max-len)`, where `max-len` is a number defining the maximum length.                                                                                       |
| [UTF-8 string](ch02-02-sequence-types.md#strings)                | `(string-utf8 max-len)`, where `max-len` is a number defining the maximum length.                                                                                        |
| [List](ch02-02-sequence-types.md#lists)                          | `(list max-len element-type)`, where `max-len` is a number defining the maximum length and `element-type` a type signature. Example: `(list 10 principal)`.              |
| [Optional](ch02-03-composite-types.md#optionals)                 | `(optional some-type)`, where `some-type` is a type signature. Example: `(optional principal)`.                                                                          |
| [Tuple](ch02-03-composite-types.md#tuples)                       | `{key1: entry-type, key2: entry-type}`, where `entry-type` is a type signature. Every key can have its own type. Example: `{sender: principal, amount: uint}`.           |
| [Response](ch02-03-composite-types.md#responses)                 | `(response ok-type err-type)`, where `ok-type` is the type of returned `ok` values and `err-type` is the type of returned `err` values. Example: `(response bool uint)`. |

We can see that some types indicate a _maximum length_. It goes without saying
that the length is strictly enforced. Passing a value that is too long will
result in an analysis error. Try changing the following example by making the
`"This works."` string too long.

```Clarity
(define-data-var message (string-ascii 15) "This works.")
```

Like other kinds of definition statements, `define-data-var` may only be used at
the top level of a smart contract definition; that is, you cannot put a define
statement in the middle of a function body.

Remember that whitespace can be used to make your code more readable. If you are
defining a complicated tuple type, simply space it out:

```Clarity
(define-data-var high-score
	;; Tuple type definition:
	{
		score: uint,
		who: (optional principal),
		at-height: uint
	}
	;; Tuple value:
	{
		score: u0,
		who: none,
		at-height: u0
	}
)

;; Print the initial value.
(print (var-get high-score))

;; Change the value.
(var-set high-score
	{score: u10, who: (some tx-sender), at-height: block-height}
)

;; Print the new value.
(print (var-get high-score))
```
