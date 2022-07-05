# Keywords

Keywords are special terms that have an assigned meaning. We already came across
a few keywords in the previous chapters: `true`, `false`, and `none`. There are
a few others that demand extra attention.

## block-height

Reflects the current block height of the Stacks blockchain as an unsigned
integer. If we imagine the chain tip to be at height 5, we can read that number
at any point in our code.

```Clarity,{"setup":["::advance_chain_tip 5"]}
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

## contract-caller

Contains the principal that called the function. It can be a standard principal
or contract principal. If the contract is called via a signed transaction
directly, then `tx-sender` and `contract-caller` will be equal. If the contract
calls another contract in turn, then `contract-caller` will be equal to the
previous contract in the chain.

```Clarity
contract-caller
```
