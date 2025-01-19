## Fulfilling listings

Now we get to the most exciting part, the ability to purchase NFTs. There are
only a few steps the markeplace goes through to validate a purchase and send the
tokens to the proper recipients. We have to handle two different payment
methodologies, payment in STX and in SIP010 tokens. The logical flow will go
like this:

1. Retrieve the listing from the `listings` data map and abort if it does not
   exist.
2. Assert that the taker is not equal to the maker.
3. Assert that the expiry block height has not been reached.
4. Assert that the provided NFT trait reference is equal to the principal stored
   in the listing.
5. Assert that the payment asset trait reference, if any, is equal to the one
   stored in the listing.
6. Transfer the NFT from the contract to the buyer and the payment asset from
   the buyer to the seller and revert if either transfer fails.
7. Delete the listing from the `listings` data map.

Most of the steps above are shared between both payment methedologie (step 7).
It therefore makes sense to create a single function that checks if all
fulfilment conditions are met. We will call this function `assert-can-fulfil`.
It will take the NFT asset contract principal, payment asset contract principal,
and listing tuple as parameters in order to validate all conditions.

```Clarity,{"nonplayable":true}
(define-private (assert-can-fulfil (nft-asset-contract principal) (payment-asset-contract (optional principal)) (listing {maker: principal, taker: (optional principal), token-id: uint, nft-asset-contract: principal, expiry: uint, price: uint, payment-asset-contract: (optional principal)}))
	(begin
		(asserts! (not (is-eq (get maker listing) contract-caller)) err-maker-taker-equal)
		(asserts! (match (get taker listing) intended-taker (is-eq intended-taker contract-caller) true) err-unintended-taker)
		(asserts! (< block-height (get expiry listing)) err-listing-expired)
		(asserts! (is-eq (get nft-asset-contract listing) nft-asset-contract) err-nft-asset-mismatch)
		(asserts! (is-eq (get payment-asset-contract listing) payment-asset-contract) err-payment-asset-mismatch)
		(ok true)
	)
)
```

The function signature looks a bit unwieldly due to the listing tuple type
definition. Remember that you can use whitespace to make it a bit more readable
if you like.

### Fulfilment in STX

With our helper function, implementing the fulfilment functions is easy. We can
call into it at the start and propagate any errors using `try!`. If
`assert-can-fulfil` returns an `ok` then we know we can move on to tranferring
the assets to the buyer and the seller. We have to make sure to delete the
listing from the data map to prevent people from trying to fulfil the listing
more than once. It is just for good form, because even if that were to happen,
the contract call would not complete because the marketplace would no longer
possess the NFT.

```Clarity,{"nonplayable":true}
(define-public (fulfil-listing-stx (listing-id uint) (nft-asset-contract <nft-trait>))
	(let (
		(listing (unwrap! (map-get? listings listing-id) err-unknown-listing))
		(taker tx-sender)
		)
		(try! (assert-can-fulfil (contract-of nft-asset-contract) none listing))
		(try! (as-contract (transfer-nft nft-asset-contract (get token-id listing) tx-sender taker)))
		(try! (stx-transfer? (get price listing) taker (get maker listing)))
		(map-delete listings listing-id)
		(ok listing-id)
	)
)
```

Returning the listing ID is again useful for a contract or frontend interacting
with the marketplace.

### Fulfilment in a SIP010 fungible token

We can now pretty much copy the previous function to create the SIP010 version.
Instead of calling `stx-transfer?`, we call the `transfer-ft` function we made
earlier.

```Clarity,{"nonplayable":true}
(define-public (fulfil-listing-ft (listing-id uint) (nft-asset-contract <nft-trait>) (payment-asset-contract <ft-trait>))
	(let (
		(listing (unwrap! (map-get? listings listing-id) err-unknown-listing))
		(taker tx-sender)
		)
		(try! (assert-can-fulfil (contract-of nft-asset-contract) (some (contract-of payment-asset-contract)) listing))
		(try! (as-contract (transfer-nft nft-asset-contract (get token-id listing) tx-sender taker)))
		(try! (transfer-ft payment-asset-contract (get price listing) taker (get maker listing)))
		(map-delete listings listing-id)
		(ok listing-id)
	)
)
```

### Testing STX order fulfilment

We are now feature-complete. Let us test order fulfilment manually before we
start working on unit tests. We again drop into a `clarinet console` session and
set the stage to conduct a trade.

First we mint an NFT and list it on the marketplace for 150 mSTX.

```Clarity,{"nonplayable":true}
>> (contract-call? .sip009-nft mint tx-sender)
Events emitted
{"type":"nft_mint_event","nft_mint_event":{"asset_identifier":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip009-nft::stacksies","recipient":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM","value":"u1"}}
(ok u1)
>> (contract-call? .tiny-market list-asset .sip009-nft {taker: none, token-id: u1, expiry: u500, price: u150, payment-asset-contract: none})
Events emitted
{"type":"nft_transfer_event","nft_transfer_event":{"asset_identifier":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip009-nft::stacksies","sender":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM","recipient":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.tiny-market","value":"u1"}}
(ok u0)
```

You might remember that we cannot purchase an NFT from ourselves. Let us try
that out first by trying to buy it right now. As seen above, the listing ID for
our NFT is `u0`. The function we should call into is `fulfil-listing-stx`.

```Clarity,{"nonplayable":true}
>> (contract-call? .tiny-market fulfil-listing-stx u0 .sip009-nft)
(err u2005)
```

An error was emitted; namely, `u2005`! Looking at our list of error constants,
we find that it is indeed the maker-taker equality check that has failed:
`err-maker-taker-equal`.

Clarinet makes it really easy to assume any `tx-sender`. We can pick the next
wallet in the list and set it as the `tx-sender` using `::set_tx_sender`. Once
we have done that we will again try to purchase the NFT from the marketplace.
Remember that once we change the `tx-sender`, the shorthand contract notation
for the marketplace and NFT contract will no longer work! You will have to write
out the
[fully qualified contract principal](ch07-03-interacting-with-your-contract.md#contract-calls).

```Clarity,{"nonplayable":true}
>> ::set_tx_sender ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
tx-sender switched to ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
>> (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.tiny-market fulfil-listing-stx u0 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip009-nft)
Events emitted
{"type":"nft_transfer_event","nft_transfer_event":{"asset_identifier":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip009-nft::stacksies","sender":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.tiny-market","recipient":"ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5","value":"u1"}}
{"type":"stx_transfer_event","stx_transfer_event":{"sender":"ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5","recipient":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM","amount":"150"}}
(ok u0)
```

Will you look at that! There is an NFT asset transfer from the marketplace
contract to the `tx-sender`, and a STX transfer from the `tx-sender` to the
original maker of the NFT listing. We can check the asset maps to verify that
the balance of the maker has increased by 150 mSTX, the balance of the taker has
decreased by the same amount, and that the taker now also owns one of our test
NFTs. The marketplace no longer owns any tokens.

```Clarity,{"nonplayable":true}
>> ::get_assets_maps
+-------------------------------------------------------+-----------------------+-----------------+
| Address                                               | .sip009-nft.stacksies | STX             |
+-------------------------------------------------------+-----------------------+-----------------+
| ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM (deployer)  | 0                     | 100000000000150 |
+-------------------------------------------------------+-----------------------+-----------------+
| ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.tiny-market | 0                     | 0               |
+-------------------------------------------------------+-----------------------+-----------------+
| ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5 (wallet_1)  | 1                     | 99999999999850  |
+-------------------------------------------------------+-----------------------+-----------------+
```

### Testing SIP010 order fulfilment

Let us also test fulfilling an order with SIP010 tokens for good measure. Start
with a fresh `clarinet session` and mint another NFT as the contract deployer.

```Clarity,{"nonplayable":true}
>> (contract-call? .sip009-nft mint tx-sender)
Events emitted
{"type":"nft_mint_event","nft_mint_event":{"asset_identifier":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip009-nft::stacksies","recipient":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM","value":"u1"}}
(ok u1)
```

Next, we mint some SIP010 tokens to _another_ standard principal. That other
principal is going to be the taker of the order. We will mint 1,000 tokens.

```Clarity,{"nonplayable":true}
>> (contract-call? .sip010-token mint u1000 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
Events emitted
{"type":"ft_mint_event","ft_mint_event":{"asset_identifier":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip010-token::amazing-coin","recipient":"ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5","amount":"1000"}}
(ok true)
```

Now we are ready to list the NFT. We will charge 800 tokens in our test. Be sure
to pass the SIP010 token contract as the `payment-asset-contract`. (And
remember, it is an `optional` type, so wrap the contract principal in a `some`.)

```Clarity,{"nonplayable":true}
>> (contract-call? .tiny-market list-asset .sip009-nft {taker: none, token-id: u1, expiry: u500, price: u800, payment-asset-contract: (some .sip010-token)})
Events emitted
{"type":"nft_transfer_event","nft_transfer_event":{"asset_identifier":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip009-nft::stacksies","sender":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM","recipient":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.tiny-market","value":"u1"}}
(ok u0)
```

Looking good so far, our listing was accepted and the NFT transferred to the
marketplace. The listing ID is again `u0` because we started a new Clarinet
session.

We can now switch the `tx-sender` to the principal we minted SIP010 tokens to
earlier. For fun, we can see if we can fulfil the listing using STX tokens
instead.

```Clarity,{"nonplayable":true}
>> ::set_tx_sender ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
tx-sender switched to ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
>> (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.tiny-market fulfil-listing-stx u0 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip009-nft)
(err u2004)
```

We get an error `u2004` which is `err-payment-asset-mismatch`, and no asset
transfer events. Good news! Now let us actually buy it with the proper payment
asset by calling into `fulfil-listing-ft`.

```Clarity,{"nonplayable":true}
>> (contract-call? 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.tiny-market fulfil-listing-ft u0 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip009-nft 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip010-token)
Events emitted
{"type":"nft_transfer_event","nft_transfer_event":{"asset_identifier":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip009-nft::stacksies","sender":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.tiny-market","recipient":"ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5","value":"u1"}}
{"type":"ft_transfer_event","ft_transfer_event":{"asset_identifier":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.sip010-token::amazing-coin","sender":"ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5","recipient":"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM","amount":"800"}}
(ok u0)
```

A bunch of transfers happened and we got a positive response. Taking a peek at
the asset maps show us that all went well. The maker received 800 SIP010 tokens
while the taker kept 200 and received the NFT. All STX balances remained
unaffected.

```Clarity,{"nonplayable":true}
>> ::get_assets_maps
+-------------------------------------------------------+-----------------------+----------------------------+-----------------+
| Address                                               | .sip009-nft.stacksies | .sip010-token.amazing-coin | STX             |
+-------------------------------------------------------+-----------------------+----------------------------+-----------------+
| ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM (deployer)  | 0                     | 800                        | 100000000000000 |
+-------------------------------------------------------+-----------------------+----------------------------+-----------------+
| ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.tiny-market | 0                     | 0                          | 0               |
+-------------------------------------------------------+-----------------------+----------------------------+-----------------+
| ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5 (wallet_1)  | 1                     | 200                        | 100000000000000 |
+-------------------------------------------------------+-----------------------+----------------------------+-----------------+
```
