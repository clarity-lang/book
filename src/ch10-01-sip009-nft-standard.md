## SIP009: the NFT standard

(The full SIP can be found here:
[https://github.com/stacksgov/sips/blob/main/sips/sip-009/sip-009-nft-standard.md](https://github.com/stacksgov/sips/blob/main/sips/sip-009/sip-009-nft-standard.md).)

NFTs—short for _non-fungible tokens_—are digital assets with unique identifiers.
Non-fungible means that the tokens are not equivalent to one another. Think of a
stamp or trading card collection. Even though they are all stamps, one
particular stamp can be rarer and thus more valuable compared to a more common
one. A concert ticket is another example. They all give you access to the venue
but some are for seats in the front whilst others put you in the back. Trading
your front-row ticket for one in the back is not an equal exchange. NFTs are the
crypto equivalent, they are digital collectibles.

The concept of NFTs as we know them today were first pioneered on the Ethereum
blockchain. You have probably already come across the acronym _ERC-721_, which
is the technical designation for an EIP721-compliant NFT on Ethereum[^1].
Reading up on its history is a fun exercise in itself.

NFTs are first-class members in Clarity. Built-in functions exist to define,
mint, transfer, and burn NFTs. However, these built-ins do not define the public
interface of NFT contracts. That is where SIP009 comes in. The standard enables
interoperability so that different contracts and apps can interact with NFTs
contracts seamlessly. Trustless marketplaces are made possible thanks to token
standards. (In fact, we will build one in a later chapter.)

### The SIP009 NFT trait

Creating a SIP009-compliant NFT comes down implementing a
[trait](ch09-00-traits.md). We start by taking a look at the trait and then
dissecting it piece by piece.

```Clarity,{"nonplayable":true}
(define-trait sip009-nft-trait
	(
		;; Last token ID, limited to uint range
		(get-last-token-id () (response uint uint))

		;; URI for metadata associated with the token 
		(get-token-uri (uint) (response (optional (string-ascii 256)) uint))

		;; Owner of a given token identifier
		(get-owner (uint) (response (optional principal) uint))

		;; Transfer from the sender to a new principal
		(transfer (uint principal principal) (response bool uint))
	)
)
```

#### get-last-token-id

A read-only function that returns the token ID of the last NFT that was created
by the contract. The ID can be used to iterate through the list and get an idea
of how many NFTs are in existence—as long as the contract does not burn tokens.
It should never return an `err` response.

#### get-token-uri

A read-only function that takes a token ID and returns a valid URI (a link)
which resolves to a metadata file for that particular NFT. The idea is that you
might want to provide some information about an NFT that you cannot or do not
want to store on-chain. For example, the URI for an NFT that represents a piece
of digital artwork could contain a link to the image file, the author, and so
on. The SIP009 standard does not provide a specification for what should exist
at the URI returned by `get-token-uri`. It is supposed to be covered by a future
SIP.

If the supplied token ID does not exist, it returns `none`.

#### get-owner

A read-only function that takes a token ID and returns the principal that owns
the specified NFT. If the supplied token ID does not exist, it returns `none`.

#### transfer

A public function that transfers ownership from one principal to another. If the
token ID does not exist, then it must return an `err` response.

[^1]: EIP, as you might have guessed, stands for Ethereum Improvement Proposal.
