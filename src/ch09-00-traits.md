# Traits

Traits are a bit like templates for smart contracts. They are a collection of
public function definitions that describe names, input types, and output types.
The purpose of a trait is to define a _public interface_ to which a contract can
conform either _implicitly_ or _explicitly_. Implicit conformity is reached by
implementing the functions defined in the trait. Explicit conformity requires
not only implementing the trait, but also asserting the implementation.

Traits are used to ensure compatibility of your smart contracts and are deployed
as separate contracts. Other contracts can then refer to these trait contracts
and assert conformity. Basically, if there is a trait `my-trait` defined in a
contract `my-contract` that is deployed on mainnet, another contract
`my-implementation` can point to `my-contract.my-trait`. Traits are integral for
dynamic inter-contract calls.
