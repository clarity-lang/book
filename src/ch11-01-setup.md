## Setup

We start our project setup as usual: `clarinet new tiny-market`. Once inside the
project folder, we will create the tiny market contract using
`clarinet contract new tiny-market`. Since our marketplace revolves around
selling NFTs, the first thing we have to do is add the
[SIP009 trait](ch10-01-sip009-nft-standard.md) and create a
[SIP009 NFT](ch10-02-creating-a-sip009-nft.md). We already made a few of these
so we will leave it as a challenge to the reader. Make sure the SIP009 contract
is called `sip009-nft-trait` and the NFT contract `sip009-nft`. You may
implement the contract any way you like as long it has a mint function that the
contract deployer can call. We will use it later for our unit tests. Here is an
example:

```Clarity,{"nonplayable":true}
(define-public (mint (recipient principal))
	(let ((token-id (+ (var-get token-id-nonce) u1)))
		(asserts! (is-eq contract-caller contract-owner) err-owner-only)
		(try! (nft-mint? stacksies token-id recipient))
		(asserts! (var-set token-id-nonce token-id) err-token-id-failure)
		(ok token-id)
	)
)
```

Once you have done that, let us add the
[SIP010 trait](ch10-03-sip010-ft-standard.md) and create a
[SIP010 token](ch10-04-creating-a-sip010-ft.md) as well. We will call these
`sip010-ft-trait` and `sip010-token`. The SIP010 token should also have a mint
function that only the contract deployer can call.

```Clarity,{"nonplayable":true}
(define-public (mint (amount uint) (recipient principal))
	(begin
		(asserts! (is-eq contract-caller contract-owner) err-owner-only)
		(ft-mint? amazing-coin amount recipient)
	)
)
```

### Trait imports & constants

Let us now work on `tiny-market`. We will start off by importing the SIP traits.
Be sure to check the naming and change them if you used different names. Do not
forget to also add the corresponding `requirements` to the project like you have
learned. We also define a constant for the contract owner.

```Clarity,{"nonplayable":true}
(use-trait nft-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)
(use-trait ft-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

(define-constant contract-owner tx-sender)
```

We will then think about the various error states that exist in our marketplace.
The act of listing an NFT may fail under a number of circumstances; namely, the
expiry block height is in the past, or the listing price is zero (we will not
allow free listings). Additionally, there is the possibility that a user may try
to list an NFT for sale without actually owning it. However, this issue will
be addressed by the NFT contract's built-in safeguards. You may remember that
the built-in NFT functions fail with an
error code if the NFT does not exist or if it is not owned by `contract-caller`. We
will simply propagate those errors using
[control flow functions](ch06-00-control-flow.md). We therefore only define two
listing error codes:

```Clarity,{"nonplayable":true}
;; listing errors
(define-constant err-expiry-in-past (err u1000))
(define-constant err-price-zero (err u1001))
```

When it comes to cancelling and fulfilling, there are a few more error
conditions we can identify:

- The listing the `tx-sender` wants to cancel or fulfil does not exist.
- The `tx-sender` tries to cancel a listing it did not create.
- The listing the `tx-sender` tries to fill has expired.
- The provided NFT asset trait reference does not match the NFT contract of the
  listing. Since trait references cannot be stored directly in Clarity, they
  will have to be provided again when the buyer is trying to purchase an NFT. We
  have to make sure that the trait reference provided by the buyer matches the
  NFT contract provided by the seller.
- The provided payment asset trait reference does not match the payment asset
  contract of the listing. The same as the above but for the SIP010 being used
  to purchase the NFT.
- The maker and the taker (seller and the buyer) are equal. We will not permit
  users to purchase tokens from themselves using the same principal.
- The buyer is not the intended taker. If the seller defines an intended taker
  (buyer) for the listing, then only that principal can fulfil the listing.

Finally, we will implement a whitelist for NFT and payment asset contracts that
the contract deployer controls. It makes for two additional error conditions:

- The NFT asset the seller is trying to list is not whitelisted.
- The requested payment asset is not whitelisted.

Turning all of these into unique error constants, we get something like the
following:

```Clarity,{"nonplayable":true}
;; cancelling and fulfilling errors
(define-constant err-unknown-listing (err u2000))
(define-constant err-unauthorised (err u2001))
(define-constant err-listing-expired (err u2002))
(define-constant err-nft-asset-mismatch (err u2003))
(define-constant err-payment-asset-mismatch (err u2004))
(define-constant err-maker-taker-equal (err u2005))
(define-constant err-unintended-taker (err u2006))
(define-constant err-asset-contract-not-whitelisted (err u2007))
(define-constant err-payment-contract-not-whitelisted (err u2008))
```

### Data storage

The marketplace itself only has to store a little information regarding the
listing. The most efficient way to store the individual listings is by using a
data map that uses an unsigned integer as a key. The integer functions as a
unique identifier and will increment for each new listing. We will never reuse a
value. To track the latest listing ID, we will use a simple data variable.

```Clarity,{"nonplayable":true}
(define-map listings
	uint
	{
		maker: principal,
		taker: (optional principal),
		token-id: uint,
		nft-asset-contract: principal,
		expiry: uint,
		price: uint,
		payment-asset-contract: (optional principal)
	}
)

(define-data-var listing-nonce uint u0)
```

It is important to utilise the native types in Clarity to the fullest extent
possible. A listing does not need to have an intended taker, so we make it
`optional`. The same goes for the payment asset. If the seller wants to be paid
in STX, then there is no payment asset. If the seller wants to be paid using a
SIP010 token, then its token contract will be stored.

### Asset whitelist

We will implement an asset whitelist to keep our marketplace safe. Only the
contract owner will have the ability to modify the whitelist. The whitelist
itself is a simple map that stores a boolean for a given contract principal. A
guarded public function `set-whitelisted` is used to update the whitelist and a
read-only function `is-whitelisted` allows anyone to check if a particular
contract is whitelisted or not. We will also use `is-whitelisted` to guard other
public functions later.

```Clarity,{"nonplayable":true}
(define-map whitelisted-asset-contracts principal bool)

(define-read-only (is-whitelisted (asset-contract principal))
	(default-to false (map-get? whitelisted-asset-contracts asset-contract))
)

(define-public (set-whitelisted (asset-contract principal) (whitelisted bool))
	(begin
		(asserts! (is-eq contract-caller contract-owner) err-unauthorised)
		(ok (map-set whitelisted-asset-contracts asset-contract whitelisted))
	)
)
```
