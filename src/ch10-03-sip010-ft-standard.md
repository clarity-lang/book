## SIP010: the FT standard

(The full SIP can be found here:
[https://github.com/stacksgov/sips/blob/main/sips/sip-010/sip-010-fungible-token-standard.md](https://github.com/stacksgov/sips/blob/main/sips/sip-010/sip-010-fungible-token-standard.md).)

Fungible tokens came after for Stacks. Indicative of the numbering, NFTs were
ratified first (in SIP009), and FTs followed in SIP010. We discussed what
non-fungibility meant in the last section and can thus deduce what a fungible
token is supposed to be. These are Bitcoins, STX tokens, US dollars, and so on.
If you trade 1 BTC for 1 BTC with somebody else, you end up just where you
started (apart from perhaps a loss in transaction fees); in other words, trading
the same amount of fungible tokens is an equivalent exchange.

These kinds of tokens are known as _ERC-20_ tokens in the Ethereum space.
Because they are so fundamental, Clarity also features built-in functions to
define fungible tokens. The SIP010 standard defines the interface that allows
for interoperability, just like how SIP009 does it for NFTs.

### The SIP010 FT trait

Creating a SIP010-compliant fungible token also comes down implementing a
[trait](ch09-00-traits.md). The trait has a few more features as fungible tokens
may be divisible—just like how you have cents to a dollar—and may have a maximum
supply.

```Clarity,{"nonplayable":true}
(define-trait sip010-ft-trait
  (
    ;; Transfer from the caller to a new principal
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))

    ;; the human readable name of the token
    (get-name () (response (string-ascii 32) uint))

    ;; the ticker symbol, or empty if none
    (get-symbol () (response (string-ascii 32) uint))

    ;; the number of decimals used, e.g. 6 would mean 1_000_000 represents 1 token
    (get-decimals () (response uint uint))

    ;; the balance of the passed principal
    (get-balance (principal) (response uint uint))

    ;; the current total supply (which does not need to be a constant)
    (get-total-supply () (response uint uint))

    ;; an optional URI that represents metadata of this token
    (get-token-uri () (response (optional (string-utf8 256)) uint))
    )
  )
```

#### transfer

A public function that transfers an amount of tokens from one principal to
another. If the balance is insufficient, then it must return an `err` response.
The transfer may optionally include a memo which is to be emitted using `print`.
Memos are useful for off-chain indexers and apps like exchanges. If a memo is
present, it should be unwrapped and emitted _after_ the token transfer.

#### get-name

A read-only function that returns a human-readable name of the token. The name
may then be used in other contracts or off-chain apps.

#### get-symbol

A read-only functions that returns the ticker symbol for the token. Like how the
ticker symbol for Stacks is STX.

#### get-decimals

Another read-only function that returns the number of decimals for the fungible
token. For example, setting it to `u6` would indicate that the token is
divisible up to six decimal spaces. One unit of the token should then be
rendered as `0.000001`. This is for display purposes only as the token amount is
always represented as an
[unsigned integer](ch02-01-primitive-types.md#unsigned-integers) internally.

#### get-balance

A read-only functions that returns the the token balance of the provided
principal.

#### get-total-supply

A read-only function that returns the current total supply of the token. The
total supply need not be a static amount.

#### get-token-uri

A read-only function that returns a valid URI (a link) which resolves to a
metadata file for the token. A preliminary structure for the metadata file
defined in the SIP is as follows:

```json
{
  "title": "Asset Metadata",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Identifies the asset to which this token represents"
    },
    "description": {
      "type": "string",
      "description": "Describes the asset to which this token represents"
    },
    "image": {
      "type": "string",
      "description": "A URI pointing to a resource with mime type image/* representing the asset to which this token represents. Consider making any images at a width between 320 and 1080 pixels and aspect ratio between 1.91:1 and 4:5 inclusive."
    }
  }
}
```

The function should return `none` if the token does not have any off-chain
metadata. It is also important to note that the return type for the function
contains a `(string-utf8 256)` as opposed to a `(string-ascii 256)`
[string type](ch02-02-sequence-types.md#strings) like we saw in
[SIP009](ch10-01-sip009-nft-standard.md).
