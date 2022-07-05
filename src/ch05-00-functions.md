# Functions

Functions are portions of code that may take some input and produce an output.
They are used to subdivide your program code into logical components.

Clarity features a plethora of built-in functions. We have already seen a few of
these in the chapters leading up to this one. Providing a full reference for all
of them is out of the scope of this book (for now), but you can refer to the
official
[Clarity Language Reference](https://docs.stacks.co/references/language-functions)
to find a detailed list. Instead, we will focus on defining custom functions and
examining what different kinds of functions exist; namely, _public functions_,
_private functions_, and _read-only functions_.

- [Public functions](ch05-01-public-functions.md) can be called externally. That
  means that another standard principal or contract principal can invoke the
  function. Public function calls require sending a transaction. The sender thus
  need to pay transaction fees.
- [Private functions](ch05-02-private-functions.md) can only be called by the
  current contract—there is no outside access. (Although the source code can
  obviously still be inspected by reading the blockchain.)
- [Read-only functions](ch05-03-read-only-functions.md) can be called externally
  but may not change the chain state. Sending a transaction is not necessary to
  call a read-only function.

Defining a custom function takes the following general form:

```Clarity,{"nonplayable":true}
(define-public function-signature function-body)
```

If you count the input parameters for the `define-public` function, you will see
that there are only two: the _function signature_ and the _function body_.

## Function signature

The function signature defines the _name_ of the function and any _input
parameters_. The input parameters themselves contain
[type signatures](ch04-02-variables.md#type-signatures).

The pattern of function signatures is such:

```Clarity,{"noneditable":true,"nonplayable":true}
(function-name (param1-name param1-type) (param2-name param2-type) ...)
```

It makes more sense if we look at a few examples. Here is a _"hello world"_
function that takes no parameters:

```Clarity
(define-public (hello-world)
	(ok "Hello World!")
)

(print (hello-world))
```

A multiplication function that takes two parameters:

```Clarity
(define-public (multiply (a uint) (b uint))
	(ok (* a b))
)

(print (multiply u5 u10))
```

A _"hello [name]"_ function that takes one string parameter:

```Clarity
(define-public (hello (name (string-ascii 30)))
	(ok (concat "Hello " name))
)

(print (hello "Clarity"))
```

## Function body

The expressions that define functions take exactly one expression for the
function body. The function body is what is executed when the function is
called. If the body is limited to one expression only, then how can you create
more complex functions that require multiple expression? For this, a special
form exists. The variadic `begin` function takes an arbitrary amount of inputs
and will return the result of the last expression.

```Clarity
(begin 3 4 5)
```

A multi-expression function may therefore be put together as follows:

```Clarity
(define-public (print-twice (first (string-ascii 40)) (second (string-ascii 40)))
	(begin
		(print first)
		(print second)
		(ok true)
	)
)

(print-twice "Hello world!" "Multiple prints!")
```

Continue to the next section to understand why that `ok` is there at the end.
