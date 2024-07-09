## Time-locked wallet

The [block height](ch03-00-keywords.md#block-height) can be used to perform
actions over time. If you know the average block time, then you can calculate
roughly how many blocks will be mined in a specific time frame. We will use this
concept to create a wallet contract that unlocks at a specific block height.
Such a contract can be useful if you want to bestow tokens to someone after a
certain time period. Imagine that in the crypto-future you want to put some
money aside for when your child comes of age. Naturally you would do this by
means of a smart contract! Let us get started.

From our main `projects` folder, we create a new project.

```bash
clarinet new timelocked-wallet
```

Inside the `timelocked-wallet` into the folder, we create the contract files
using the following command:

```bash
clarinet contract new timelocked-wallet
```

### Features

Instead of starting to code straight away, let us take a moment to consider the
features we want to have.

- A user can deploy the time-locked wallet contract.
- Then, the user specifies a block height at which the wallet unlocks and a
  beneficiary.
- Anyone, not just the contract deployer, can send tokens to the contract.
- The beneficiary can claim the tokens once the specified block height is
  reached.
- Additionally, the beneficiary can transfer the right to claim the wallet to a
  different principal. (For whatever reason.)

With the above in mind, the contract will thus feature the following public
functions:

- `lock`, takes the principal, unlock height, and an initial deposit amount.
- `claim`, transfers the tokens to the `tx-sender` if and only if the unlock
  height has been reached and the `tx-sender` is equal to the beneficiary.
- `bestow`, allows the beneficiary to transfer the right to claim the wallet.

### Constants & variables

Contracts should be as easy to read and maintainable as possible. We will
therefore make generous use of [constants](ch04-01-constants.md) to not only
define the contract owner but also various error states. Errors can take the
following forms:

- Somebody other than the contract owner called `lock`.
- The contract owner tried to call `lock` more than once.
- The passed unlock height is in the past.
- The owner called `lock` with an initial deposit of zero (`u0`).
- Somebody other than the beneficiary called `claim` or `lock`.
- The beneficiary called `claim` but the unlock height has not yet been reached.

Two [data variables](ch04-02-variables.md) are needed to store the beneficiary
and the unlock height as an
[unsigned integer](ch02-01-primitive-types.md#unsigned-integers). We will make
the beneficiary an optional principal type to account for the uninitialised
state of the contract. (That is, before the contract owner called `lock`.)

```Clarity,{"nonplayable":true}
;; Owner
(define-constant contract-owner tx-sender)

;; Errors
(define-constant err-owner-only (err u100))
(define-constant err-already-locked (err u101))
(define-constant err-unlock-in-past (err u102))
(define-constant err-no-value (err u103))
(define-constant err-beneficiary-only (err u104))
(define-constant err-unlock-height-not-reached (err u105))

;; Data
(define-data-var beneficiary (optional principal) none)
(define-data-var unlock-height uint u0)
```

The error codes themselves are made up. They are meant to be processed by a
frontend application for our contract. As long as we use the `(err ...)`
response type, we know for sure that
[any possible changes will revert](ch06-00-control-flow.md).

### Implementing lock

The `lock` function does nothing more than transferring some tokens from the
`tx-sender` to itself and setting the two variables. However, we must not forget
to check if the proper conditions are set. Specifically:

- Only the contract owner may call `lock`.
- The wallet cannot be locked twice.
- The passed unlock height should be at some point in the future; that is, it
  has to be larger than the current height.
- The initial deposit should be larger than zero. Also, the deposit should
  succeed.

Most of those translate into [assertions](ch06-00-control-flow.md#asserts). The
function is thus implemented as follows:

```Clarity,{"nonplayable":true}
(define-public (lock (new-beneficiary principal) (unlock-at uint) (amount uint))
	(begin
		(asserts! (is-eq contract-caller contract-owner) err-owner-only)
		(asserts! (is-none (var-get beneficiary)) err-already-locked)
		(asserts! (> unlock-at block-height) err-unlock-in-past)
		(asserts! (> amount u0) err-no-value)
		(try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
		(var-set beneficiary (some new-beneficiary))
		(var-set unlock-height unlock-at)
		(ok true)
	)
)
```

Notice how we can use the constants we defined before as the
[throw values](ch06-00-control-flow.md#asserts) for the assertions? That allows
for some pretty legible code. The `(as-contract tx-sender)` part gives us the
principal of the contract.

### Implementing bestow

The `bestow` function will be straightforward. It checks if the `contract-caller` is
the current beneficiary, and if so, will update the beneficiary to the passed
principal. One side-note to keep in mind is that the principal is stored as an
`(optional principal)`. We thus need to wrap the `contract-caller` in a `(some ...)`
before we do the comparison.

```Clarity,{"nonplayable":true}
(define-public (bestow (new-beneficiary principal))
	(begin
		(asserts! (is-eq (some contract-caller) (var-get beneficiary)) err-beneficiary-only)
		(var-set beneficiary (some new-beneficiary))
		(ok true)
	)
)
```

### Implementing claim

Finally, the `claim` function should check if both the `contract-caller` is the
beneficiary and that the unlock height has been reached.

```Clarity,{"nonplayable":true}
(define-public (claim)
	(begin
		(asserts! (is-eq (some contract-caller) (var-get beneficiary)) err-beneficiary-only)
		(asserts! (>= block-height (var-get unlock-height)) err-unlock-height-not-reached)
		(as-contract (stx-transfer? (stx-get-balance tx-sender) tx-sender (unwrap-panic (var-get beneficiary))))
	)
)
```

### Manual testing

Time to hop into a `clarinet console` session to try out the contract.

```bash
Contracts
+-------------------------------------------------------------+--------------------------------------+
| Contract identifier                                         | Public functions                     |
+-------------------------------------------------------------+--------------------------------------+
| ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.timelocked-wallet | (bestow (new-beneficiary principal)) |
|                                                             | (claim)                              |
|                                                             | (lock                                |
|                                                             |     (new-beneficiary principal)      |
|                                                             |     (unlock-at uint)                 |
|                                                             |     (amount uint))                   |
+-------------------------------------------------------------+--------------------------------------+
```

If the contract does not show up, then there was a bug or syntax error. Use
`clarinet check` to track them down.

For the first test, the wallet will be locked for the first principal that comes
after the deployer (`wallet_1`). We can pick a block height that is really low
as console sessions always starts at a block height of zero. Here is the console
interaction to lock the wallet until height 10, with an initial deposit of 100
mSTX:

```Clarity,{"nonplayable":true}
>> (contract-call? .timelocked-wallet lock 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK u10 u100)
Events emitted
{"type":"stx_transfer_event","stx_transfer_event":{"sender":"ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE","recipient":"ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.timelocked-wallet","amount":"100"}}
```

That worked! Pay close attention to the STX transfer event from the `tx-sender`
to the contract. The balance of the contract can be verified using the
management command `::get_assets_maps`.

```bash
>> ::get_assets_maps
+-------------------------------------------------------------+---------+
| Address                                                     | STX     |
+-------------------------------------------------------------+---------+
| ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE (deployer)        | 999900  |
+-------------------------------------------------------------+---------+
| ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.timelocked-wallet | 100     |
+-------------------------------------------------------------+---------+
```

We then assume the identity of the beneficiary and see if we can claim the
wallet. (Remember the
[full contract principal](ch02-01-primitive-types.md#principals) has to be
specified
[in this case](ch07-03-interacting-with-your-contract.md#contract-calls).)

```Clarity,{"nonplayable":true}
>> ::set_tx_sender ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK
tx-sender switched to ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK
>> (contract-call? 'ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.timelocked-wallet claim)
(err u105)
```

Trying to claim returns a `(err u105)`. That is the error value we related to
the unlock height not having been reached. So far so good.

The block height in the REPL does not increment by itself. Mining can be
simulated by using `::advance_chain_tip`. Let us see if we can claim the wallet
after incrementing the block height by ten.

```Clarity,{"nonplayable":true}
>> ::advance_chain_tip 10
10 blocks simulated, new height: 10
>> (contract-call? 'ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.timelocked-wallet claim)
Events emitted
{"type":"stx_transfer_event","stx_transfer_event":{"sender":"ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE.timelocked-wallet","recipient":"ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK","amount":"100"}}
(ok true)
```

The `ok` and STX transfer event prove that it worked. Feel free to check the
asset maps for good measure.

### Unit tests

We identify the following cases in order to write comprehensive unit tests. The
smart contract:

- Allows the contract owner to lock an amount.
- Does not allow anyone else to lock an amount.
- Cannot be locked more than once.
- Cannot set the unlock height to a value less than the current block height.
- Allows the beneficiary to bestow the right to claim to someone else.
- Does not allow anyone else to bestow the right to claim to someone else. (Not
  even the contract owner.)
- Allows the beneficiary to claim the balance when the block height is reached.
- Does not allow the beneficiary to claim the balance before the block-height is
  reached.
- Nobody but the beneficiary can claim the balance once the block height is
  reached.

Clarinet features built-in assertion functions to check if an expected STX
transfer event actually happened. Those will be used to keep the unit tests
succinct.

The test file for a contract is always found in the `tests` folder. It is named
after the contract: `timelocked-wallet_test.ts`. Clear the file but be sure to
keep the `import` statement at the top.

### Testing lock

We start by writing the four tests that cover the different cases of `lock`.

```typescript
Clarinet.test({
  name: "Allows the contract owner to lock an amount",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const beneficiary = accounts.get("wallet_1")!;
    const amount = 10;
    const block = chain.mineBlock([
      Tx.contractCall(
        "timelocked-wallet",
        "lock",
        [
          types.principal(beneficiary.address),
          types.uint(10),
          types.uint(amount),
        ],
        deployer.address
      ),
    ]);

    // The lock should be successful.
    block.receipts[0].result.expectOk().expectBool(true);
    // There should be a STX transfer of the amount specified.
    block.receipts[0].events.expectSTXTransferEvent(
      amount,
      deployer.address,
      `${deployer.address}.timelocked-wallet`
    );
  },
});

Clarinet.test({
  name: "Does not allow anyone else to lock an amount",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const accountA = accounts.get("wallet_1")!;
    const beneficiary = accounts.get("wallet_2")!;
    const block = chain.mineBlock([
      Tx.contractCall(
        "timelocked-wallet",
        "lock",
        [types.principal(beneficiary.address), types.uint(10), types.uint(10)],
        accountA.address
      ),
    ]);

    // Should return err-owner-only (err u100).
    block.receipts[0].result.expectErr().expectUint(100);
  },
});

Clarinet.test({
  name: "Cannot lock more than once",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const beneficiary = accounts.get("wallet_1")!;
    const amount = 10;
    const block = chain.mineBlock([
      Tx.contractCall(
        "timelocked-wallet",
        "lock",
        [
          types.principal(beneficiary.address),
          types.uint(10),
          types.uint(amount),
        ],
        deployer.address
      ),
      Tx.contractCall(
        "timelocked-wallet",
        "lock",
        [
          types.principal(beneficiary.address),
          types.uint(10),
          types.uint(amount),
        ],
        deployer.address
      ),
    ]);

    // The first lock worked and STX were transferred.
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[0].events.expectSTXTransferEvent(
      amount,
      deployer.address,
      `${deployer.address}.timelocked-wallet`
    );

    // The second lock fails with err-already-locked (err u101).
    block.receipts[1].result.expectErr().expectUint(101);

    // Assert there are no transfer events.
    assertEquals(block.receipts[1].events.length, 0);
  },
});

Clarinet.test({
  name: "Unlock height cannot be in the past",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const beneficiary = accounts.get("wallet_1")!;
    const targetBlockHeight = 10;
    const amount = 10;

    // Advance the chain until the unlock height plus one.
    chain.mineEmptyBlockUntil(targetBlockHeight + 1);

    const block = chain.mineBlock([
      Tx.contractCall(
        "timelocked-wallet",
        "lock",
        [
          types.principal(beneficiary.address),
          types.uint(targetBlockHeight),
          types.uint(amount),
        ],
        deployer.address
      ),
    ]);

    // The second lock fails with err-unlock-in-past (err u102).
    block.receipts[0].result.expectErr().expectUint(102);

    // Assert there are no transfer events.
    assertEquals(block.receipts[0].events.length, 0);
  },
});
```

### Testing bestow

`bestow` is a simple function that allows the beneficiary to transfer the right
to claim. We therefore have to make sure that only the beneficiary can
successfully call `bestow`.

```typescript
Clarinet.test({
  name: "Allows the beneficiary to bestow the right to claim to someone else",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const beneficiary = accounts.get("wallet_1")!;
    const newBeneficiary = accounts.get("wallet_2")!;
    const block = chain.mineBlock([
      Tx.contractCall(
        "timelocked-wallet",
        "lock",
        [types.principal(beneficiary.address), types.uint(10), types.uint(10)],
        deployer.address
      ),
      Tx.contractCall(
        "timelocked-wallet",
        "bestow",
        [types.principal(newBeneficiary.address)],
        beneficiary.address
      ),
    ]);

    // Both results are (ok true).
    block.receipts.map(({ result }) => result.expectOk().expectBool(true));
  },
});

Clarinet.test({
  name: "Does not allow anyone else to bestow the right to claim to someone else (not even the contract owner)",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const beneficiary = accounts.get("wallet_1")!;
    const accountA = accounts.get("wallet_3")!;
    const block = chain.mineBlock([
      Tx.contractCall(
        "timelocked-wallet",
        "lock",
        [types.principal(beneficiary.address), types.uint(10), types.uint(10)],
        deployer.address
      ),
      Tx.contractCall(
        "timelocked-wallet",
        "bestow",
        [types.principal(deployer.address)],
        deployer.address
      ),
      Tx.contractCall(
        "timelocked-wallet",
        "bestow",
        [types.principal(accountA.address)],
        accountA.address
      ),
    ]);

    // All but the first call fails with err-beneficiary-only (err u104).
    block.receipts
      .slice(1)
      .map(({ result }) => result.expectErr().expectUint(104));
  },
});
```

### Testing claim

For `claim`, we test the cases of the unlock height being reached or not, and
that only the beneficiary can claim.

```typescript
Clarinet.test({
  name: "Allows the beneficiary to claim the balance when the block-height is reached",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const beneficiary = accounts.get("wallet_1")!;
    const targetBlockHeight = 10;
    const amount = 10;
    chain.mineBlock([
      Tx.contractCall(
        "timelocked-wallet",
        "lock",
        [
          types.principal(beneficiary.address),
          types.uint(targetBlockHeight),
          types.uint(amount),
        ],
        deployer.address
      ),
    ]);

    // Advance the chain until the unlock height.
    chain.mineEmptyBlockUntil(targetBlockHeight);

    const block = chain.mineBlock([
      Tx.contractCall("timelocked-wallet", "claim", [], beneficiary.address),
    ]);

    // The claim was successful and the STX were transferred.
    block.receipts[0].result.expectOk().expectBool(true);
    block.receipts[0].events.expectSTXTransferEvent(
      amount,
      `${deployer.address}.timelocked-wallet`,
      beneficiary.address
    );
  },
});

Clarinet.test({
  name: "Does not allow the beneficiary to claim the balance before the block-height is reached",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const beneficiary = accounts.get("wallet_1")!;
    const targetBlockHeight = 10;
    const amount = 10;
    chain.mineBlock([
      Tx.contractCall(
        "timelocked-wallet",
        "lock",
        [
          types.principal(beneficiary.address),
          types.uint(targetBlockHeight),
          types.uint(amount),
        ],
        deployer.address
      ),
    ]);

    // Advance the chain until the unlock height minus one.
    chain.mineEmptyBlockUntil(targetBlockHeight - 1);

    const block = chain.mineBlock([
      Tx.contractCall("timelocked-wallet", "claim", [], beneficiary.address),
    ]);

    // Should return err-unlock-height-not-reached (err u105).
    block.receipts[0].result.expectErr().expectUint(105);
    assertEquals(block.receipts[0].events.length, 0);
  },
});

Clarinet.test({
  name: "Does not allow anyone else to claim the balance when the block-height is reached",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get("deployer")!;
    const beneficiary = accounts.get("wallet_1")!;
    const other = accounts.get("wallet_2")!;
    const targetBlockHeight = 10;
    const amount = 10;
    chain.mineBlock([
      Tx.contractCall(
        "timelocked-wallet",
        "lock",
        [
          types.principal(beneficiary.address),
          types.uint(targetBlockHeight),
          types.uint(amount),
        ],
        deployer.address
      ),
    ]);

    // Advance the chain until the unlock height.
    chain.mineEmptyBlockUntil(targetBlockHeight);

    const block = chain.mineBlock([
      Tx.contractCall("timelocked-wallet", "claim", [], other.address),
    ]);

    // Should return err-beneficiary-only (err u104).
    block.receipts[0].result.expectErr().expectUint(104);
    assertEquals(block.receipts[0].events.length, 0);
  },
});
```

The full source code of the project can be found here:
https://github.com/clarity-lang/book/tree/main/projects/timelocked-wallet.
