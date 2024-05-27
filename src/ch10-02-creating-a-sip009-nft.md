## Creating a SIP009 NFT

About time we create our own SIP009-compliant NFT! We will quickly go over the
aforementioned built-in NFT functions to understand how they work and what their
limitations are, and then use them to implement the SIP009 trait.

### Built-in NFT functions

A new non-fungible token class is defined using the `define-non-fungible-token`
function. NFTs have a unique asset name (per contract) and are individually
identified by an asset identifier. The developer is free to choose the
identifier type although an incrementing unsigned integer is most common.

```Clarity,{"nonplayable":true}
(define-non-fungible-token asset-name asset-identifier-type)
```

The naming schedule is the same as those for variables or function names. The
asset identifier type is a normal
[type signature](ch04-02-variables.md#type-signatures). We can create an NFT
class `my-awesome` token, identified by an unsigned integer as follows:

```Clarity
(define-non-fungible-token my-awesome-token uint)
```

One can then use the functions `nft-mint?`, `nft-transfer?`, `nft-get-owner?`,
and `nft-burn?` to manage the NFT.

```Clarity
;; Define my-awesome-token
(define-non-fungible-token my-awesome-token uint)

;; Mint NFT with ID u1 and give it to tx-sender.
(nft-mint? my-awesome-token u1 tx-sender)

;; Transfer the NFT with ID u1 from tx-sender to another principal.
(nft-transfer? my-awesome-token u1 tx-sender 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK)

;; Get and print the new owner of the NFT with ID u1.
(print (nft-get-owner? my-awesome-token u1))

;; Burn the NFT with ID u1 (destroys it)
(nft-burn? my-awesome-token u1 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK)
```

Click the play button on the example above or copy it to the REPL to see the NFT
events emitted for each function. Try defining and minting multiple NFTs, doing
transfers and burns. Like the others, these functions are safe by design. It is
not possible to transfer NFTs a principal does not own, minting an NFT with
the same ID twice, and burning tokens that do not exist.

### Project setup

Let us create a new Clarinet project for our custom NFT contract.

```bash
clarinet new sip009-nft
```

The `nft-trait` trait that we will implement has an
[official mainnet deployment address](https://explorer.stacks.co/txid/0x80eb693e5e2a9928094792080b7f6d69d66ea9cc881bc465e8d9c5c621bd4d07?chain=mainnet)
as detailed in the SIP document. Inside the `sip009-nft` project folder, we
first specify a dependency on this trait, using Clarinet's `requirements`:

```bash
clarinet requirements add SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait
```

That command adds the following to `Clarinet.toml`:

```toml
[[project.requirements]]
contract_id = "SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait"
```

Clarinet uses this information to download the contract from the network and
takes care of deploying it to local or test networks for your testing.

We then create the contract that will implement our custom NFT. Give it a flashy
name if you like.

```bash
clarinet contract new stacksies
```

### Preparation work

We have dealt with traits before, so we know that we should
[explicitly assert conformity](ch09-02-implementing-traits.md#asserting-trait-conformance).

```Clarity,{"nonplayable":true}
(impl-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)
```

Adding this line makes it impossible to deploy the contract if it does not fully
implement the SIP009 trait.

Since the SIP requires the asset identifier type to be an unsigned integer, we
add our NFT definition next.

```Clarity,{"nonplayable":true}
(define-non-fungible-token stacksies uint)
```

The asset identifier should be an incrementing unsigned integer. The easiest way
to implement it is to increment a counter variable each time a new NFT is
minted. Let us define a data variable for it.

```Clarity,{"nonplayable":true}
(define-data-var last-token-id uint u0)
```

Finally, we will add a constant for the contract deployer and two error codes.
Here is everything put together:

```Clarity,{"nonplayable":true}
(impl-trait 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.nft-trait.nft-trait)

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))

(define-non-fungible-token stacksies uint)

(define-data-var last-token-id uint u0)
```

### Implementing the SIP009 NFT trait

The implementation is rather simple, thanks to the built-in NFT functionality.

#### get-last-token-id

We use a variable to track the last token ID.

```Clarity,{"nonplayable":true}
(define-read-only (get-last-token-id)
	(ok (var-get last-token-id))
)
```

#### get-token-uri

The idea of `get-token-uri` is to return a link to metadata for the specified
NFT. Our practice NFT does not have a website so we can return `none`.

```Clarity,{"nonplayable":true}
(define-read-only (get-token-uri (token-id uint))
	(ok none)
)
```

If we did have a website, we could append the `token-id` to a URL prefix to
generate the complete URL:

```Clarity,{"nonplayable":true}
(define-read-only (get-token-uri (token-id uint))
  (ok (concat "https://domain.tld/metadata/" (int-to-ascii token-id)))
)
```

#### get-owner

The `get-owner` function only has to wrap the built-in `nft-get-owner?`.

```Clarity,{"nonplayable":true}
(define-read-only (get-owner (token-id uint))
	(ok (nft-get-owner? stacksies token-id))
)
```

#### transfer

The `transfer` function should assert that the `sender` is equal to the
`contract-caller` to prevent principals from transferring tokens they do not own.

```Clarity,{"nonplayable":true}
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
	(begin
		(asserts! (is-eq contract-caller sender) err-not-token-owner)
		(nft-transfer? stacksies token-id sender recipient)
	)
)
```

#### mint

We will also add a convenience function to mint new tokens. A simple guard to
check if the `contract-caller` is equal to the `contract-owner` constant will prevent
others from minting new tokens. The function will increment the last token ID
and then mint a new token for the recipient.

```Clarity,{"nonplayable":true}
(define-public (mint (recipient principal))
	(let
		(
			(token-id (+ (var-get last-token-id) u1))
		)
		(asserts! (is-eq contract-caller contract-owner) err-owner-only)
		(try! (nft-mint? stacksies token-id recipient))
		(var-set last-token-id token-id)
		(ok token-id)
	)
)
```

### Manual testing

Check if the contract conforms to SIP009 with `clarinet check`. We then enter a
console session `clarinet console` and try to mint a token for ourselves.

```Clarity,{"nonplayable":true}
>> (contract-call? .stacksies mint tx-sender)
Events emitted
{"type":"nft_mint_event","nft_mint_event":{"asset_identifier":"ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.stacksies::stacksies","recipient":"ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE","value":"u1"}}
(ok u1)
```

You can see the NFT mint event and the resulting `ok` response. We can transfer
the newly minted token with ID `u1` to a different principal.

```Clarity,{"nonplayable":true}
>> (contract-call? .stacksies transfer u1 tx-sender 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK)
Events emitted
{"type":"nft_transfer_event","nft_transfer_event":{"asset_identifier":"ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.stacksies::stacksies","sender":"ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE","recipient":"ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK","value":"u1"}}
(ok true)
```

`get-owner` confirms that the token is now owned by the specified principal.

```Clarity,{"nonplayable":true}
>> (contract-call? .stacksies get-owner u1)
(ok (some ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK))
```

That is all there is to it! NFTs in Clarity are really quite easy to do. The
full source code of the project can be found here:
https://github.com/clarity-lang/book/tree/main/projects/sip009-nft.
