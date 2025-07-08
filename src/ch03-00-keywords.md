# Keywords

Keywords are special terms that have an assigned meaning. We already came across
a few keywords in the previous chapters: `true`, `false`, and `none`. There are
a few others that demand extra attention.

## block-height

Reflects the current block height of the Stacks blockchain as an unsigned
integer. If we imagine the chain tip to be at height 5, we can read that number
at any point in our code.

```Clarity,{"mineBlocks": 5}
block-height
```

## burn-block-height

Reflects the current block height of the underlying burn blockchain (in this
case Bitcoin) as an unsigned integer.

```Clarity
burn-block-height
```

## tx-sender

Contains the principal that sent the transaction. It can be used to validate the
principal that is calling into a public function.

```Clarity
tx-sender
```

Note that it is possible for the `tx-sender` to be a contract principal if the
special function `as-contract` was used to shift the sending context.

```Clarity
(as-contract tx-sender)
```

Note that using `tx-sender` as a check for permission to call a contract can expose you to a vulnerability where a malicious contract could trick a user into calling it instead of the intended contract, but the `tx-sender` check would pass, since it returns the original contract caller.

For example, I think I am calling contract A, but am socially engineered into calling contract b instead. Contract b then calls into contract a but passes different parameters. Any permission checks in contract A will pass since I am the original `tx-sender`.

For this reason, it is recommended to instead use `contract-caller`, described below.

## contract-caller

Contains the principal that called the function. It can be a standard principal
or contract principal. If the contract is called via a signed transaction
directly, then `tx-sender` and `contract-caller` will be equal. If the contract
calls another contract in turn, then `contract-caller` will be equal to the
previous contract in the chain.

```Clarity
contract-caller
```

In the above example, contract A would not be vulnerable to this exploit, since a permission check using `contract-caller` would result in the malicious contract, failing the permission check.

Don't worry if this isn't fully clear now. It will become clear as we go through examples in the book.
