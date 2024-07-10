## Listing & cancelling sales

Our marketplace functions as an escrow contract at its bare essence. It takes
someone's NFT, along with some conditions, and releases it when these conditions
are met. One of those conditions is providing right payment tokens. Most of the
functionality thus involves tokens, which means it useful to create some helper
functions that transfer NFTs and fungible tokens. The functions will take a
trait reference (either SIP009 or SIP010) and then do the proper
`contract-call?` to transfer the token.

```Clarity,{"nonplayable":true}
(define-private (transfer-nft (token-contract <nft-trait>) (token-id uint) (sender principal) (recipient principal))
	(contract-call? token-contract transfer token-id sender recipient)
)

(define-private (transfer-ft (token-contract <ft-trait>) (amount uint) (sender principal) (recipient principal))
	(contract-call? token-contract transfer amount sender recipient none)
)
```

We will use these functions to implement the rest of the marketplace.

### Listing an NFT

Principals will call into a function `list-asset` to put their NFT up for sale.
The call will have to include a trait reference and a tuple that contains the
information to store in the `listing` map we came up with in the
[previous section](ch11-01-setup.md). The flow of the listing function will go
something like this:

1. Retrieve the current listing ID to use by reading the `listing-nonce`
   variable.
2. Assert that the NFT asset is whitelisted.
3. Assert that the provided expiry height is somewhere in the future.
4. Assert that the listing price is larger than zero.
5. If a payment asset is given, assert that it is whitelisted.
6. Transfer the NFT from the `tx-sender` to the marketplace.
7. Store the listing information in the `listings` data map.
8. Increment the `listing-nonce` variable.
9. Return an `ok` to materialise the changes.

We will return the listing ID when everything goes well as a convenience for
frontends and other contracts that interact with the marketplace.

```Clarity,{"nonplayable":true}
(define-public (list-asset (nft-asset-contract <nft-trait>) (nft-asset {taker: (optional principal), token-id: uint, expiry: uint, price: uint, payment-asset-contract: (optional principal)}))
	(let ((listing-id (var-get listing-nonce)))
		(asserts! (is-whitelisted (contract-of nft-asset-contract)) err-asset-contract-not-whitelisted)
		(asserts! (> (get expiry nft-asset) block-height) err-expiry-in-past)
		(asserts! (> (get price nft-asset) u0) err-price-zero)
		(asserts! (match (get payment-asset-contract nft-asset) payment-asset (is-whitelisted payment-asset) true) err-payment-contract-not-whitelisted)
		(try! (transfer-nft nft-asset-contract (get token-id nft-asset) tx-sender (as-contract tx-sender)))
		(map-set listings listing-id (merge {maker: tx-sender, nft-asset-contract: (contract-of nft-asset-contract)} nft-asset))
		(var-set listing-nonce (+ listing-id u1))
		(ok listing-id)
	)
)
```

Pay close attention to the `map-set` expression. Notice the `merge`? It merges
two tuples together, which in this case is the information provided by the user,
plus a tuple that sets the `maker` key to `tx-sender` and the
`nft-asset-contract` to a value equal to `(contract-of nft-asset-contract)`. The
`contract-of` expression takes a principal passed via a trait reference and
turns it into a generic `principal` type. We do this because a trait reference
`<nft-trait>` cannot be stored in a data map. You will see why this is useful
later.

Finally, we create a read-only function that returns a listing by ID as usual.

```Clarity,{"nonplayable":true}
(define-read-only (get-listing (listing-id uint))
	(map-get? listings listing-id)
)
```

### Cancelling a listing

A listing is available until it either expires or is cancelled by the maker.
When the maker cancels the listing, all that has to happen is for the
marketplace to send the NFT back and delete the listing from the data map. The
maker only has to provide the listing ID and the NFT asset contract trait
reference. The rest can be read from the data map.

```Clarity,{"nonplayable":true}
(define-public (cancel-listing (listing-id uint) (nft-asset-contract <nft-trait>))
	(let (
		(listing (unwrap! (map-get? listings listing-id) err-unknown-listing))
		(maker (get maker listing))
		)
		(asserts! (is-eq maker contract-caller) err-unauthorised)
		(asserts! (is-eq (get nft-asset-contract listing) (contract-of nft-asset-contract)) err-nft-asset-mismatch)
		(map-delete listings listing-id)
		(as-contract (transfer-nft nft-asset-contract (get token-id listing) tx-sender maker))
	)
)
```

See how we check if the trait reference is equal to the contract principal
stored in the listing? Even though we cannot store trait references, we can
still verify that the expected trait reference was passed.

### Testing listing and cancelling

Let us perform a quick manual test to see if it all works as expected. We can
drop into a `clarinet console` session and perform the steps manually.

We first mint an NFT for ourselves.

```Clarity,{"nonplayable":true}
>> (contract-call? .sip009-nft mint tx-sender)
Events emitted
{"type":"nft_mint_event","nft_mint_event":{"asset_identifier":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip009-nft::stacksies","recipient":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM","value":"u1"}}
(ok u1)
```

We will also verify if we actually own it.

```Clarity,{"nonplayable":true}
>> (contract-call? .sip009-nft get-owner u1)
(ok (some ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM))
```

Before we can list it, we have to whitelist the NFT contract.

```Clarity,{"nonplayable":true}
>> (contract-call? .tiny-market set-whitelisted .test-sip009 true)
(ok true)
```

Then we try to list the NFT for sale on the marketplace for an amount of
`u1000`. We will set the expiry to block 500 and have no intended taker or
payment asset contract.

```Clarity,{"nonplayable":true}
>> (contract-call? .tiny-market list-asset .sip009-nft {taker: none, token-id: u1, expiry: u500, price: u1000, payment-asset-contract: none})
Events emitted
{"type":"nft_transfer_event","nft_transfer_event":{"asset_identifier":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip009-nft::stacksies","sender":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM","recipient":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.tiny-market","value":"u1"}}
(ok u0)
```

Great! Looks like that worked. It returned an `ok` value with the listing ID,
which for the first one is naturally `u0`. We can then retrieve that listing:

```Clarity,{"nonplayable":true}
>> (contract-call? .tiny-market get-listing u0)
(some {expiry: u500, maker: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM, nft-asset-contract: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip009-nft, payment-asset-contract: none, price: u1000, taker: none, token-id: u1})
```

Who now owns the NFT? We can check by querying the NFT contract again.

```Clarity,{"nonplayable":true}
>> (contract-call? .sip009-nft get-owner u1)
(ok (some ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.tiny-market))
```

Looks like it is owned by the marketplace contract as expected!

For fun, let us see what happens if we try to list an NFT we do not own. For
example with a bogus token ID of 555.

```Clarity,{"nonplayable":true}
>> (contract-call? .tiny-market list-asset .sip009-nft {taker: none, token-id: u555, expiry: u500, price: u1000, payment-asset-contract: none})
(err u3)
```

And finally, we can cancel the listing and get the NFT back.

```Clarity,{"nonplayable":true}
>> (contract-call? .tiny-market cancel-listing u0 .sip009-nft)
Events emitted
{"type":"nft_transfer_event","nft_transfer_event":{"asset_identifier":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip009-nft::stacksies","sender":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.tiny-market","recipient":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM","value":"u1"}}
(ok true)
```

And we can see it was transferred back to us.
