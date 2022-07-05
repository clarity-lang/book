# Storing data

Smart contracts have their own private storage space. You can define different
types of data members to use throughout your smart contract. These data members
are committed to the chain and thus persist across transactions. For example, a
first transaction can change a data member after which a second one reads the
updated value.

All data members have to be defined on the top level of the contract and are
identified by a unique name. No new data members can be introduced after the
contract has been deployed. Clarity permits three different kinds of storage:
_constants_, _variables_, and _data maps_.

- [Constant](ch04-01-constants.md) values are unchangeable, defined on the top
  level of the contract. They are useful to define the contract owner, error
  codes, and other static values.
- [Variables](ch04-02-variables.md) have an initial value and can be changed by
  means of future contract calls. One variable contains exactly one value of a
  predefined [type](ch04-02-variables.md#type-signatures).
- [Maps](ch04-03-maps.md) are collections of data identified by other data.
  Think of variables where the variable names themselves are values. They are
  used to relate one value to another; for example, relating specific principals
  to unsigned integers to keep track of scores.

Although data members are _private_—meaning, only the current contract can use
them—it does not mean that they are _hidden_. **Anything on the blockchain is
inherently public so data members should never be used to store sensitive
information like passwords or private keys.** The value of any data member can
be extracted from the chain state effortlessly.
