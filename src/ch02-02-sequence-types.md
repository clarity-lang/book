## Sequences

Sequences hold a sequence of data, as the name implies. Clarity provides three
different kinds of sequences: _buffers_, _strings_, and _lists_.

### Buffers

Buffers are unstructured data of a fixed maximum length. They always start with
the prefix `0x` followed by a
[hexadecimal](https://en.wikipedia.org/wiki/Hexadecimal) string. Each byte is
thus represented by two so-called
[hexits](https://en.wiktionary.org/wiki/hexit).

```Clarity
0x68656c6c6f21
```

The buffer above spells out _"hello!"_. (Copy and paste it to
[this page](https://coding.tools/hex-to-ascii) to verify.)

### Strings

A string is a sequence of characters. These can be defined as
[ASCII](https://en.wikipedia.org/wiki/ASCII) strings or
[UTF-8](https://en.wikipedia.org/wiki/UTF-8) strings. ASCII strings may only
contain basic Latin characters whilst UTF-8 strings can contain fun stuff like
emoji. Both strings are enclosed in double-quotes (`"`) but UTF-8 strings are
also prefixed by a `u`. Just like buffers, strings always have a fixed maximum
length in Clarity.

ASCII:

```Clarity
"This is an ASCII string"
```

UTF-8:

```Clarity
u"And this is an UTF-8 string \u{1f601}"
```

You can use strings to pass names and messages.

### Lists

Lists are sequences of fixed length that contain another type. Since types
cannot mix, a list can only contain items of the same type. Take this list of
_signed integers_ for example:

```Clarity
(list 4 8 15 16 23 42)
```

As you can see, a list is constructed using the `list` function. Here is a list
of ASCII strings:

```Clarity
(list "Hello" "World" "!")
```

And just for completeness, here is a list that is invalid due to mixed types:

```Clarity
(list u5 10 "hello") ;; This list is invalid.
```

Lists are very useful and make it a lot easier to perform actions in bulk. (For
example, sending some tokens to a list of people.) You can _iterate_ over a list
using the `map` or `fold` functions.

`map` applies an input function to each element and returns a new list with the
updated values. The `not` function inverts a boolean (`true` becomes `false` and
`false` becomes `true`). We can thus invert a list of booleans like this:

```Clarity
(map not (list true true false false))
```

`fold` applies an input function to each element of the list _and_ the output
value of the previous application. It also takes an initial value to use for the
second input for the first element. The returned result is the last value
returned by the final application. This function is also commonly called
_reduce_, because it reduces a list to a single value. We can use `fold` to sum
numbers in a list by applying the `+` (addition) function with an initial value
of `u0`:

```Clarity
(fold + (list u1 u2 u3) u0)
```

The snippet above can be expanded to the following:

```Clarity
(+ u3 (+ u2 (+ u1 u0)))
```

### Working with sequences

#### Length

Sequences always have a specific length, which we can retrieve using the `len`
function.

A buffer (remember that each byte is represented as two hexits):

```Clarity
(len 0x68656c6c6f21)
```

A string:

```Clarity
(len "How long is this string?")
```

And a list:

```Clarity
(len (list 4 8 15 16 23 42))
```

#### Retrieving elements

They also allow you to extract elements at a particular index. The following
takes the _fourth_ element from the list. (Counting starts at 0.)

```Clarity
(element-at (list 4 8 15 16 23 42) u3)
```

You can also do the reverse and find the index of a particular item in a
sequence. We can search the list to see if it contains the value `23`.

```Clarity
(index-of (list 4 8 15 16 23 42) 23)
```

And we get `(some u4)`, indicating there is a value of `23` at index four. The
attentive might now be wondering, what is this _"some"_? Read on and all will be
revealed in the next section.
