## Creating a SIP010 fungible token

We are getting the hang of this implementation stuff. Let us now implement a
SIP010 fungible token.

### Built-in FT functions

Fungible tokens can also easily be defined using built-in functions. The
counterpart for fungible tokens is the `define-fungible-token` function. Just
like NFTs, fungible tokens have a unique asset name per contract.

```Clarity,{"nonplayable":true}
(define-fungible-token asset-name maximum-supply)
```

An optional maximum total supply can be defined by provider an unsigned integer
as the second parameter. If left out, the token has no maximum total supply.
Setting a maximum total supply ensures that no more than the provided amount can
ever be minted.

The expected functions to manage fungible tokens follow the same naming
schedule:

```Clarity
;; Define clarity-coin with a maximum of 1,000,000 tokens.
(define-fungible-token clarity-coin u1000000)

;; Mint 1,000 tokens and give them to tx-sender.
(ft-mint? clarity-coin u1000 tx-sender)

;; Transfer 500 tokens from tx-sender to another principal.
(ft-transfer? clarity-coin u500 tx-sender 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK)

;; Get and print the token balance of tx-sender.
(print (ft-get-balance clarity-coin tx-sender))

;; Burn 250 tokens (destroys them)
(ft-burn? clarity-coin u250 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK)

;; Get and print the circulating supply
(print (ft-get-supply clarity-coin))
```

Click the play button on the example above or copy it to the REPL to see the FT
events emitted for each function. Play around with the code by minting,
transferring, and burning tokens. You will notice that built-in safeties prevent
you from transferring more tokens than a principal owns and minting more than
the maximum supply.

### Project setup

Let us create a new Clarinet project for our custom NFT contract.

```bash
clarinet new sip010-ft
```

Inside the `sip010-ft` project folder, we first add the requirement for the
trait, using the
[official mainnet deployment address](https://explorer.stacks.co/txid/0x99e01721e57adc2c24f7d371b9d302d581dba1d27250c7e25ea5f241af14c387?chain=mainnet).

```bash
clarinet requirements add SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard
```

We then create the contract that will implement our custom fungible token.
Another flashy name is welcome.

```bash
clarinet contract new clarity-coin
```

### Preparation work

Asserting
[explicit conformity](ch09-02-implementing-traits.md#asserting-trait-conformance)
with the trait is the first step as usual.

```Clarity,{"nonplayable":true}
(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
```

We can then add the token definition, a constant for the contract deployer, and
two error codes:

```Clarity,{"nonplayable":true}
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))

;; No maximum supply!
(define-fungible-token clarity-coin)
```

### Implementing the SIP010 FT trait

#### transfer

The `transfer` function should assert that the `sender` is equal to the
`contract-caller` to prevent principals from transferring tokens they do not own. It
should also unwrap and print the `memo` if it is not `none`. We use `match` to
conditionally call `print` if the passed `memo` is a `some`.

```Clarity,{"nonplayable":true}
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
	(begin
		(asserts! (is-eq contract-caller sender) err-not-token-owner)
		(try! (ft-transfer? clarity-coin amount sender recipient))
		(match memo to-print (print to-print) 0x)
		(ok true)
	)
)
```

Play with this snippet to see how `match` works.

```Clarity
(match (some "inner string")
	inner-str (print inner-str)
	(print "got nothing")
)
```

#### get-name

A static function that returns a human-readable name for our token.

```Clarity,{"nonplayable":true}
(define-read-only (get-name)
	(ok "Clarity Coin")
)
```

#### get-symbol

A static function that returns a human-readable symbol for our token.

```Clarity,{"nonplayable":true}
(define-read-only (get-symbol)
	(ok "CC")
)
```

#### get-decimals

As was established in the previous section, the value returned by this function
is purely for display reasons. Let us follow along with STX and introduce 6
decimals.

```Clarity,{"nonplayable":true}
(define-read-only (get-decimals)
	(ok u6)
)
```

#### get-balance

This function returns the balance of a specified principal. We simply wrap the
built-in function that retrieves the balance.

```Clarity,{"nonplayable":true}
(define-read-only (get-balance (who principal))
	(ok (ft-get-balance clarity-coin who))
)
```

#### get-total-supply

This function returns the total supply of our custom token. We again simply wrap
the built-in function for it.

```Clarity,{"nonplayable":true}
(define-read-only (get-total-supply)
	(ok (ft-get-supply clarity-coin))
)
```

#### get-token-uri

This function has the same purpose as `get-token-uri` in
[SIP009](ch10-01-sip009-nft-standard.md#get-token-uri). It should return a link
to a metadata file for the token. Our practice fungible token does not have a
website so we can return `none`.

```Clarity,{"nonplayable":true}
(define-read-only (get-token-uri)
	(ok none)
)
```

#### mint

Just like our custom NFT, we will add a convenience function to mint new tokens
that only the contract deployer can successfully call.

```Clarity,{"nonplayable":true}
(define-public (mint (amount uint) (recipient principal))
	(begin
		(asserts! (contract-caller contract-owner) err-owner-only)
		(ft-mint? clarity-coin amount recipient)
	)
)
```

### Manual testing

Check if the contract conforms to SIP010 with `clarinet check`. We then enter a
console session `clarinet console` and try to mint some tokens for ourselves.

```Clarity,{"nonplayable":true}
>> (contract-call? .clarity-coin mint u1000 tx-sender)
Events emitted
{"type":"ft_mint_event","ft_mint_event":{"asset_identifier":"ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.clarity-coin::clarity-coin","recipient":"ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE","amount":"1000"}}
(ok true)
```

You can see the FT mint event and the resulting `ok` response. We minted a
thousand tokens for `tx-sender`. Let us try to transfer some of those to a
different principal.

```Clarity,{"nonplayable":true}
>> (contract-call? .clarity-coin transfer u250 tx-sender 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK none)
Events emitted
{"type":"ft_transfer_event","ft_transfer_event":{"asset_identifier":"ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.clarity-coin::clarity-coin","sender":"ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE","recipient":"ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK","amount":"250"}}
(ok true)
```

The `none` at the end is the (absence of a) memo. We can do another transfer
with a memo to see if it is printed to the screen.

```Clarity,{"nonplayable":true}
>> (contract-call? .clarity-coin transfer u100 tx-sender 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK (some 0x123456))
Events emitted
{"type":"ft_transfer_event","ft_transfer_event":{"asset_identifier":"ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.clarity-coin::clarity-coin","sender":"ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE","recipient":"ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK","amount":"100"}}
{"type":"contract_event","contract_event":{"contract_identifier":"ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.clarity-coin","topic":"print","value":"0x123456"}}
(ok true)
```

Great! We see an FT transfer event followed by a print event of `0x123456`. The
recipient principal should have a total of 350 tokens by now. We can verify the
balance by querying the contract:

```Clarity,{"nonplayable":true}
>> (contract-call? .clarity-coin get-balance 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK)
(ok u350)
```

The full source code of the project can be found here:
https://github.com/clarity-lang/book/tree/main/projects/sip010-ft.
