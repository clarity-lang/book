## Primitives

Primitive types are the most basic components. These are: _signed and unsigned
integers_, _booleans_, and _principals_.

### Signed integers

`int`, short for _(signed) integer_. These are 128-bit numbers that can either
be positive or negative. The minimum value is -2^127 and the maximum value is
2^127 - 1. Some examples: `0`, `5000`, `-45`.

### Unsigned integers

`uint`, short for _unsigned integer_. These are 128-bit numbers that can only
be positive. The minimum value is therefore 0 and the maximum value is
2^128 - 1. **Unsigned integers are always prefixed by the character `u`.** Some
examples: `u0`, `u40935094534`.

Clarity has many built-in functions that accept either signed or unsigned
integers.

Addition:

```Clarity
(+ u2 u3)
```

Subtraction:

```Clarity
(- 5 10)
```

Multiplication:

```Clarity
(* u2 u16)
```

Division:

```Clarity
(/ 100 4)
```

As you might have noticed by now, integers are always whole numbers—there are no
decimal points. It is something to keep in mind when writing your code.

```Clarity
(/ u10 u3)
```

If you punch the above into a calculator, you will likely get `3.3333333333...`.
Not with integers! The above expression evaluates to `u3`, the decimals are
dropped.

There are many more functions that take integers as inputs. We will get to the
rest later in the book.

### Booleans

`bool`, short for _boolean_. A boolean value is either `true` or `false`. They
are used to check if a certain condition is met or unmet (true or false). Some
built-in functions that accept booleans:

`not` (inverts a boolean):

```Clarity
(not true)
```

`and` (returns `true` if all inputs are `true`):

```Clarity
(and true true true)
```

`or` (returns `true` if at least one input is `true`):

```Clarity
(or false true false)
```

### Principals

A principal is a special type in Clarity and represents a Stacks address on
the blockchain. It is a unique identifier you can roughly equate to an email
address or bank account number—although definitely not the same! You might have
also heard the term _wallet address_ as well. Clarity admits two different kinds
of principals: _standard principals_ and _contract principals_. Standard
principals are backed by a corresponding private key whilst contract principals
point to a smart contract. Principals follow a specific structure and always
start with the characters `SP` for the Stacks mainnet and `ST` for the testnet
and mocknet[^1].

A literal principal value is prefixed by a single quote (`'`) in Clarity. Notice
there is no closing single quote.

```Clarity
'ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE
```

Contract principals are a compound of the standard principal that deployed the
contract and the contract name, delimited by a dot:

```Clarity
'ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.my-awesome-contract
```

You will use the principal type often when writing Clarity. It is used to check
who is calling the contract, recording information about different principals,
function calls across contracts, and much more.

To retrieve the current STX balance of a principal, we can pass it to the
`stx-get-balance` function.

```Clarity
(stx-get-balance 'ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE)
```

Both kinds of principals can hold tokens, we can thus also check the balance of
a contract.

```Clarity
(stx-get-balance 'ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.my-contract)
```

Zero balances are a little boring, so let us send some STX to a principal:

```Clarity
(stx-transfer? u500 tx-sender 'ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE)
```

---

Knowing about primitives, and the fact that types can never mix, it is now clear
why the example in the previous section does not work. Since the first number is
a _signed integer_ and the next one is an _unsigned integer_—notice the `u`—the
analyser rejects the code as invalid. We should provide it with two signed or
two unsigned integers instead.

Incorrect:

```Clarity
(+ 2 u3)
```

Correct:

```Clarity
(+ u2 u3)
```

[^1]: More on the different kinds of networks in a later chapter.
