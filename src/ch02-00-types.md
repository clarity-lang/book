# Types

(If you are looking for _type signatures_, see the later
[chapter on variables](ch04-02-variables.md#type-signatures).)

An important concept for many programming languages are the so-called _types_. A
type defines what kind of information can be stored inside a _variable_. If you
imagine a variable to be a container that can hold something, the type defines
what kind of thing it holds.

Types are strictly enforced and cannot mix in Clarity.
[Type safety](https://en.wikipedia.org/wiki/Type_safety) is key because type
errors (mixing two different types) can lead to unexpected errors with grave
consequences. Clarity therefore rejects any kind of type mixing. Here is an
example:

```Clarity
(+ 2 u3)
```

The expression above results in an error:

> Analysis error: expecting expression of type **'int'**, found **'uint'** (+ 2
> u3)

Before we can properly answer the question of _which_ type it was expecting
_where_, let us take a look at the different types in Clarity. Types fall in
three categories: _primitives_, _sequences_, and _composites_.

- [Primitives](ch02-01-primitive-types.md) are the basic building blocks for the
  language. They include numbers and boolean values (true and false).
- [Sequences](ch02-02-sequence-types.md) hold multiple values in order.
- [Composites](ch02-03-composite-types.md) are complex types that are made up of
  other types.
