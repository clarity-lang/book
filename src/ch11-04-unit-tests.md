## Unit tests

The `tiny-market` contract is more sizeable than what we have built before. We
will make an effort to structure the unit tests to avoid repetition. Common
actions are turned into helper functions so that we can call them when needed.
These include:

- Turning an `Account` and contract name into a contract principal string.
- Minting a new token for testing, both for NFTs and payment assets.
- Asserting that an NFT token transfer has happened. (Clarinet does not support
  this yet.)
- Creating an order tuple.
- Creating a transaction for common actions like whitelisting an asset contract
  or listing an NFT.

### Importing methods and hardcoding constants

Unit tests in Clarinet require certain methods that will assist with the unit tests themselves in regards to the actual testing and conversion of Clarity values. Retrieving the default provided wallets in simnet are also available on the global variable `simnet`. We'll pull out 4 different accounts for this and hardcode our contract names.

```ts
import { ClarityEvent } from "@hirosystems/clarinet-sdk";
import { Cl } from "@stacks/transactions";
import { describe, test, expect } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

const contractName = "tiny-market";
const defaultNftAssetContract = "sip009-nft";
const defaultPaymentAssetContract = "sip010-token";

const contractPrincipal = `${deployer}.${contractName}`;
```

### Token minting helpers

To prevent hard-coding contract names in our tests, we define a constant for
each. The helper functions will construct the contract call to the `mint`
function and mine a block to include it. The chain and deployer parameters will
be passed in by the tests themselves. The functions then return some helpful
information like the NFT asset contract principal, the token ID or amount, and
the block data itself.

```ts
function mintNft({
  deployer,
  recipient,
  nftAssetContract = defaultNftAssetContract,
}: {
  deployer: string;
  recipient: string;
  nftAssetContract?: string;
}) {
  const mintResponse = simnet.callPublicFn(
    nftAssetContract,
    "mint",
    [Cl.principal(recipient)],
    deployer
  );
  
  expect(mintResponse.events).toHaveLength(1);
  expect(mintResponse.events[0].event).toBe("nft_mint_event");
  const nftMintEvent = mintResponse.events[0];

  return {
    nftAssetContract: nftMintEvent.data.asset_identifier.split("::")[0],
    tokenId: nftMintEvent.data.value.value,
  };
}

function mintFt({
  deployer,
  amount,
  recipient,
  paymentAssetContract = defaultPaymentAssetContract,
}: {
  deployer: string;
  amount: number;
  recipient: string;
  paymentAssetContract?: string;
}) {
  const mintResponse = simnet.callPublicFn(
    paymentAssetContract,
    "mint",
    [Cl.uint(amount), Cl.principal(recipient)],
    deployer
  );

  expect(mintResponse.result).toBeOk(Cl.bool(true));
  expect(mintResponse.events).toHaveLength(1);
  expect(mintResponse.events[0].event).toBe("ft_mint_event");

  expect(mintResponse.events).toHaveLength(1);
  expect(mintResponse.events[0].event).toBe("ft_mint_event");
  const ftMintEvent = mintResponse.events[0];

  return {
    paymentAssetContract: ftMintEvent.data.asset_identifier.split("::")[0],
    paymentAssetId: ftMintEvent.data.asset_identifier.split("::")[1],
  };
}
```

### Asserting NFT transfers

NFT transfer events are emitted by Clarinet but no function exists to assert
their existence. We therefore make our own and define a basic interface that
describes the transfer event. It will check that an event with the expected
properties exists: the right NFT asset contract, token ID, and principal.

```ts
function assertNftTransfer(
  event: ClarityEvent,
  nftAssetContract: string,
  tokenId: number,
  sender: string,
  recipient: string
) {
  expect(typeof event).toBe("object")
  expect(event.event).toBe("nft_transfer_event")

  expect(
    event.data.asset_identifier.substr(
      0,
      nftAssetContract.length
    )
  ).toBe(nftAssetContract);

  expect(event.data.sender).toBe(sender)
  expect(event.data.recipient).toBe(recipient)
  expect(event.data.value.value).toBe(tokenId)
}
```

### Order tuple helper

Since listing assets by calling into `list-asset` is something that we will do
quite often, we will also create a helper function that constructs the
`net-asset` order tuple. The function takes an object with properties equal to
that of the tuple, just camel-cased instead of with dashes.

```ts
interface Order {
  taker?: string;
  tokenId: number;
  expiry: number;
  price: number;
  paymentAssetContract?: string;
}

const makeOrder = (order: Order) =>
  Cl.tuple({
    taker: order.taker ? Cl.some(Cl.principal(order.taker)) : Cl.none(),
    "token-id": Cl.uint(order.tokenId),
    expiry: Cl.uint(order.expiry),
    price: Cl.uint(order.price),
    "payment-asset-contract": order.paymentAssetContract
      ? Cl.some(Cl.principal(order.paymentAssetContract))
      : Cl.none(),
  });
```

### Whitelisting transaction

The helper to create a whitelisting transaction is a one-liner. It takes the
asset contract to whitelist and whether it should be whitelisted, finally the
the contract owner that should send the transaction, as it is a guarded
function.

```ts
const whitelistAssetTx = (
  assetContract: string,
  whitelisted: boolean,
  contractOwner: string
) =>
  simnet.callPublicFn(
    contractName,
    "set-whitelisted",
    [Cl.principal(assetContract), Cl.bool(whitelisted)],
    contractOwner
  );
```

### Listing an NFT

Listing a new order is likewise a one-liner. We will also make it so that you
can pass in both an `Order` object or an order tuple (which is represented as a
string by Clarinet). If an `Order` is passed, all we have to do is call the
`makeOrder` helper.

```ts
const listOrderTx = (
  nftAssetContract: string,
  maker: string,
  order: Order
) =>
  simnet.callPublicFn(
    contractName,
    "list-asset",
    [
      Cl.principal(nftAssetContract),
      makeOrder(order),
    ],
    maker
  );
```

### Listing tests

We can then use the helpers to construct our first tests: listing an NFT for
sale for STX and for SIP010 fungible tokens.

```ts
describe("Listing tests", () => {
  test("Can list an NFT for sale for STX", () => {
    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });

    const order: Order = { tokenId, expiry: 10, price: 10 };

    whitelistAssetTx(nftAssetContract, true, deployer)

    let listResponse = listOrderTx(nftAssetContract, wallet1, order)

    expect(listResponse.result).toBeOk(Cl.uint(0));
    expect(listResponse.events[0].event, "nft_transfer_event");
    expect(listResponse.events[0].data.sender).toBe(wallet1);
    expect(listResponse.events[0].data.recipient).toBe(
      deployer + ".tiny-market"
    );
  });

  test("Can list an NFT for sale for any SIP010 fungible token", () => {

    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });

    let { paymentAssetContract, paymentAssetId } = mintFt({deployer, amount: 100, recipient: wallet1})

    const order: Order = { tokenId, expiry: 10, price: 10, paymentAssetContract };

    whitelistAssetTx(nftAssetContract, true, deployer)
    whitelistAssetTx(paymentAssetContract, true, deployer)

    let listResponse = listOrderTx(nftAssetContract, wallet1, order)

    expect(listResponse.result).toBeOk(Cl.uint(0));

    let nftTransferEvent = listResponse.events.find(e => e.event === 'nft_transfer_event')!
    assertNftTransfer(nftTransferEvent, nftAssetContract, tokenId, wallet1, contractPrincipal)
  });
});
```

### Invalid listings

A listing call should fail under the following circumstances:

- The expiry block height of the order is in the past.
- The NFT is being listed for nothing. (A price of zero.)
- Someone is trying to list an NFT for sale that the sender does not own.

```ts
describe("Invalid listings", () => {
  test("Cannot list an NFT for sale if the expiry is in the past", () => {

    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });

    const { paymentAssetContract, paymentAssetId } = mintFt({
      deployer,
      recipient: wallet1,
      amount: 1,
    });

    const order: Order = {
      tokenId,
      expiry: 10,
      price: 10,
      paymentAssetContract,
    };

    whitelistAssetTx(nftAssetContract, true, deployer)
    whitelistAssetTx(paymentAssetContract, true, deployer)

    let listResponse = listOrderTx(nftAssetContract, wallet1, order)

    expect(listResponse.result).toBeOk(Cl.uint(0));
  });

  test("Cannot list an NFT for sale for nothing", () => {

    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });

    const order: Order = { tokenId, expiry: 10, price: 0 };

    whitelistAssetTx(nftAssetContract, true, deployer)

    let listResponse = listOrderTx(nftAssetContract, wallet1, order)

    expect(listResponse.result).toBeErr(Cl.uint(1001));
  });

  test("Cannot list an NFT for sale that the sender does not own", () => {

    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet2,
    });

    const order: Order = { tokenId, expiry: 10, price: 10 };

    whitelistAssetTx(nftAssetContract, true, deployer)

    let listResponse = listOrderTx(nftAssetContract, wallet3, order)

    expect(listResponse.result).toBeErr(Cl.uint(1));
    expect(listResponse.events).toHaveLength(0);
  });
});
```

### Cancelling listings

Only the maker can cancel an active listing, we will cover this with two tests.

```ts
describe("Cancelling listings", () => {
  test("Maker can cancel a listing", () => {

    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });

    const order: Order = { tokenId, expiry: 10, price: 10 };

    whitelistAssetTx(nftAssetContract, true, deployer)

    let listResponse = listOrderTx(nftAssetContract, wallet1, order)

    const cancelResponse = simnet.callPublicFn(
      contractName,
      "cancel-listing",
      [listResponse.result.value, Cl.principal(nftAssetContract)],
      wallet1
    );

    expect(cancelResponse.result).toBeOk(Cl.bool(true));
  });

  test("Non-maker cannot cancel listing", () => {

    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });

    const order: Order = { tokenId, expiry: 10, price: 10 };

    whitelistAssetTx(nftAssetContract, true, deployer)

    listOrderTx(nftAssetContract, wallet1, order)

    const cancelResponse = simnet.callPublicFn(
      contractName,
      "cancel-listing",
      [Cl.uint(0), Cl.principal(nftAssetContract)],
      wallet2
    );

    expect(cancelResponse.result).toBeErr(Cl.uint(2001));
    expect(cancelResponse.events).toHaveLength(0);
  });
});
```

### Retrieving listings

Listings can be retrieved until they are cancelled. We will add a test that
retrieves an active listing and make sure that the returned tuple contains the
information we expect. The next test verifies that retrieving a listing that is
cancelled or does not exist returns `none`.

```ts
describe("Retrieving listings", () => {
  test("Can get listings that have not been cancelled", () => {
    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });

    const order: Order = { tokenId, expiry: 10, price: 10 };

    whitelistAssetTx(nftAssetContract, true, deployer)

    let listResponse = listOrderTx(nftAssetContract, wallet1, order)

    let receipt = simnet.callReadOnlyFn(
      contractPrincipal,
      "get-listing",
      [listResponse.result.value],
      deployer
    )

    let listingInfo = receipt.result.value.value

    expect(listingInfo['token-id']).toBeUint(1)
  })

  test("Cannot get listings that have been cancelled or do not exist", () => {
    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });

    const order: Order = { tokenId, expiry: 10, price: 10 };

    whitelistAssetTx(nftAssetContract, true, deployer)

    let listResponse = listOrderTx(nftAssetContract, wallet1, order)

    let cancelListingResponse = simnet.callPublicFn(
      contractPrincipal,
      'cancel-listing',
      [listResponse.result.value, Cl.principal(nftAssetContract)],
      wallet1
    )
    
    let receipt = simnet.callReadOnlyFn(
      contractPrincipal,
      "get-listing",
      [listResponse.result.value],
      deployer
    )

    expect(receipt.result).toBeNone()
  })
})
```

### Fulfilling listings

And here are the ones we have been waiting for: the tests for order fulfilment.
Since a seller can list an NFT for sale for either STX or SIP010 tokens, we
write a separate test for both.

```ts
describe("Fulfilling listings", () => {
  test("Can fulfill an active listing with STX", () => {
    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });
    
    const order: Order = { tokenId, expiry: 10, price: 10 };

    whitelistAssetTx(nftAssetContract, true, deployer)

    let listResponse = listOrderTx(nftAssetContract, wallet1, order)

    const fulfilResponse = simnet.callPublicFn(
      contractName,
      "fulfil-listing-stx",
      [Cl.uint(0), Cl.principal(nftAssetContract)],
      wallet2
    );

    let nftTransferEvent = fulfilResponse.events.find(e => e.event === 'nft_transfer_event')!

    assertNftTransfer(nftTransferEvent, nftAssetContract, tokenId, contractPrincipal, wallet2)
    
    expect(fulfilResponse.result).toBeOk(Cl.uint(0));

    expect(fulfilResponse.events[1].event).toBe("stx_transfer_event");

    expect(fulfilResponse.events[1].data).toMatchObject({
      amount: order.price.toString(),
      sender: wallet2,
      recipient: wallet1,
    });
  });

  test("Can fulfil an active listing with SIP010 fungible tokens", () => {
    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });

    let { paymentAssetContract, paymentAssetId } = mintFt({deployer, amount: 100, recipient: wallet1})
    mintFt({deployer, amount: 100, recipient: wallet2})

    const order: Order = { tokenId, expiry: 10, price: 10, paymentAssetContract };

    whitelistAssetTx(nftAssetContract, true, deployer)
    whitelistAssetTx(paymentAssetContract, true, deployer)

    let listResponse = listOrderTx(nftAssetContract, wallet1, order)

    expect(listResponse.result).toBeOk(Cl.uint(0));

    let nftTransferEvent = listResponse.events.find(e => e.event === 'nft_transfer_event')!
    assertNftTransfer(nftTransferEvent, nftAssetContract, tokenId, wallet1, contractPrincipal)

    const fulfilResponse = simnet.callPublicFn(
      contractName,
      "fulfil-listing-ft",
      [Cl.uint(0), Cl.principal(nftAssetContract), Cl.principal(paymentAssetContract)],
      wallet2
    );

    expect(fulfilResponse.result).toBeOk(Cl.uint(0))    
  })
});
```

### Basic fulfilment errors

There are some basic situations in which fulfilment fails, these are:

- The seller is trying to buy its own NFT,
- A buyer is trying to fulfil a listing that does not exist; and,
- A buyer is trying to fulfil a listing that has expired.

```ts
describe("Basic fulfilment errors", () => {
  test("Cannot fulfil own listing", () => {
    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });
    
    const order: Order = { tokenId, expiry: 10, price: 10 };

    whitelistAssetTx(nftAssetContract, true, deployer)

    listOrderTx(nftAssetContract, wallet1, order)

    const fulfilResponse = simnet.callPublicFn(
      contractName,
      "fulfil-listing-stx",
      [Cl.uint(0), Cl.principal(nftAssetContract)],
      wallet1
    );

    expect(fulfilResponse.result).toBeErr(Cl.uint(2005))    
  })

  test("Cannot fulfil an unknown listing", () => {
    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });
    
    const order: Order = { tokenId, expiry: 10, price: 10 };

    whitelistAssetTx(nftAssetContract, true, deployer)

    listOrderTx(nftAssetContract, wallet1, order)

    const fulfilResponse = simnet.callPublicFn(
      contractName,
      "fulfil-listing-stx",
      [Cl.uint(8), Cl.principal(nftAssetContract)],
      wallet1
    );

    expect(fulfilResponse.result).toBeErr(Cl.uint(2000))   
  })

  test("Cannot fulfil an expired listing", () => {
    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });
    
    const order: Order = { tokenId, expiry: 10, price: 10 };

    whitelistAssetTx(nftAssetContract, true, deployer)

    listOrderTx(nftAssetContract, wallet1, order)

    simnet.mineEmptyBlocks(50)

    const fulfilResponse = simnet.callPublicFn(
      contractName,
      "fulfil-listing-stx",
      [Cl.uint(0), Cl.principal(nftAssetContract)],
      wallet2
    );

    expect(fulfilResponse.result).toBeErr(Cl.uint(2002))   
  })
})
```

### Wrong payment asset or trait reference

We now add tests that confirm that a listing cannot be fulfilled with the wrong
payment asset. We test both STX and SIP010 tokens, as well as the situation
where the transaction sender passes in the wrong asset trait reference.

Since we have to test our listings against different assets we need to
instantiate a bogus NFT and payment asset contract. We could copy and paste our
test asset contracts but that seems tedious. Clarinet actually allows you to
instantiate the same contract file under a different name. Open `Clarinet.toml`
and add an entry for our `bogus-nft` by coping the entry for `sip009-nf`.

```toml
[contracts.sip009-nft]
path = "contracts/sip009-nft.clar"

[contracts.bogus-nft]
path = "contracts/sip009-nft.clar"
```

Then we do the same for the payment asset. We will call the new entry
`bogus-ft`.

```toml
[contracts.sip010-token]
path = "contracts/sip010-token.clar"

[contracts.bogus-ft]
path = "contracts/sip010-token.clar"
```

From this point on, `sip009-nft.clar` and `sip010-token.clar` will be
instantiated twice under different names. Quite useful for our tests.

```ts
describe("Wrong payment asset or trait reference", () => {
  test("Cannot fulfil a listing with a different NFT contract reference", () => {
    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });
    
    const order: Order = { tokenId, expiry: 10, price: 10 };

    whitelistAssetTx(nftAssetContract, true, deployer)

    listOrderTx(nftAssetContract, wallet1, order)

    const fulfilResponse = simnet.callPublicFn(
      contractName,
      "fulfil-listing-stx",
      [Cl.uint(0), Cl.principal(`${deployer}.bogus-nft`)],
      wallet2
    );

    expect(fulfilResponse.result).toBeErr(Cl.uint(2003))
  })

  test("Cannot fulfil an active STX listing with SIP010 fungible tokens", () => {
    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });

    let { paymentAssetContract } = mintFt({deployer, amount: 100, recipient: wallet2})
    
    const order: Order = { tokenId, expiry: 10, price: 10 };

    whitelistAssetTx(nftAssetContract, true, deployer)

    listOrderTx(nftAssetContract, wallet1, order)

    const fulfilResponse = simnet.callPublicFn(
      contractName,
      "fulfil-listing-ft",
      [Cl.uint(0), Cl.principal(nftAssetContract), Cl.principal(paymentAssetContract)],
      wallet2
    );

    expect(fulfilResponse.result).toBeErr(Cl.uint(2004))
  })

  test("Cannot fulfil an active SIP010 fungible token listing with STX", () => {
    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });

    let { paymentAssetContract, paymentAssetId } = mintFt({deployer, amount: 100, recipient: wallet1})
    mintFt({deployer, amount: 100, recipient: wallet2})

    const order: Order = { tokenId, expiry: 10, price: 10, paymentAssetContract };

    whitelistAssetTx(nftAssetContract, true, deployer)
    whitelistAssetTx(paymentAssetContract, true, deployer)

    let listResponse = listOrderTx(nftAssetContract, wallet1, order)

    expect(listResponse.result).toBeOk(Cl.uint(0));

    let nftTransferEvent = listResponse.events.find(e => e.event === 'nft_transfer_event')!
    assertNftTransfer(nftTransferEvent, nftAssetContract, tokenId, wallet1, contractPrincipal)

    const fulfilResponse = simnet.callPublicFn(
      contractName,
      "fulfil-listing-stx",
      [Cl.uint(0), Cl.principal(nftAssetContract)],
      wallet2
    );

    expect(fulfilResponse.result).toBeErr(Cl.uint(2004))
  })

  test("Cannot fulfil an active SIP010 fungible token listing with a different SIP010 fungible token contract reference", () => {
    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });

    let { paymentAssetContract } = mintFt({deployer, amount: 100, recipient: wallet1})

    const order: Order = { tokenId, expiry: 10, price: 10, paymentAssetContract };

    whitelistAssetTx(nftAssetContract, true, deployer)
    whitelistAssetTx(paymentAssetContract, true, deployer)

    let listResponse = listOrderTx(nftAssetContract, wallet1, order)

    expect(listResponse.result).toBeOk(Cl.uint(0));

    let nftTransferEvent = listResponse.events.find(e => e.event === 'nft_transfer_event')!
    assertNftTransfer(nftTransferEvent, nftAssetContract, tokenId, wallet1, contractPrincipal)

    const fulfilResponse = simnet.callPublicFn(
      contractName,
      "fulfil-listing-ft",
      [Cl.uint(0), Cl.principal(nftAssetContract), Cl.principal(`${deployer}.bogus-ft`)],
      wallet2
    );

    expect(fulfilResponse.result).toBeErr(Cl.uint(2004))
  })
})
```

### Insufficient balance

It should naturally be impossible to purchase an NFT if the buyer does not have
sufficient payment asset balance. There should be no token events in such cases.

```ts
describe("Insufficient balance", () => {
  test("Cannot fulfil an active STX listing with insufficient balance", () => {
    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });
    
    const order: Order = { tokenId, expiry: 10, price: 10 };

    whitelistAssetTx(nftAssetContract, true, deployer)

    let listResponse = listOrderTx(nftAssetContract, wallet1, order)

    let listingId = listResponse.result.value

    const assets = simnet.getAssetsMap();
    const stxBalances = assets.get('STX')!;
    const wallet2Balance = stxBalances.get(wallet2)!;
    simnet.transferSTX(wallet2Balance, wallet3, wallet2)

    const fulfilResponse = simnet.callPublicFn(
      contractName,
      "fulfil-listing-stx",
      [listingId, Cl.principal(nftAssetContract)],
      wallet2
    );
    
    expect(fulfilResponse.result).toBeErr(Cl.uint(1))
  })

  test("Cannot fulfil an active SIP010 fungible token listing with insufficient balance", () => {
    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });

    let { paymentAssetContract } = mintFt({deployer, amount: 100, recipient: wallet1})

    const order: Order = { tokenId, expiry: 10, price: 10, paymentAssetContract };

    whitelistAssetTx(nftAssetContract, true, deployer)
    whitelistAssetTx(paymentAssetContract, true, deployer)

    let listResponse = listOrderTx(nftAssetContract, wallet1, order)
    let listingId = listResponse.result.value

    expect(listResponse.result).toBeOk(Cl.uint(0));

    const fulfilResponse = simnet.callPublicFn(
      contractName,
      "fulfil-listing-ft",
      [listingId, Cl.principal(nftAssetContract), Cl.principal(paymentAssetContract)],
      wallet3
    );

    expect(fulfilResponse.result).toBeErr(Cl.uint(1))  
  })
})
```

### Intended taker

Sellers have the ability to list an NFT for sale that only one specific
principal can purchase, by setting the "intended taker" field. Another two tests
are in order: one where an intended taker is indeed able to fulfil a listing,
and another where an unintended take is not able to fulfil the listing.

```ts
describe("Intended taker", () => {
  test('"Intended taker can fulfill active listing"', () => {
    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });

    const order: Order = { tokenId, expiry: 10, price: 10, taker: wallet2 };

    whitelistAssetTx(nftAssetContract, true, deployer)

    let listResponse = listOrderTx(nftAssetContract, wallet1, order)
    let listingId = listResponse.result.value

    const fulfilResponse = simnet.callPublicFn(
      contractName,
      "fulfil-listing-stx",
      [listingId, Cl.principal(nftAssetContract)],
      wallet2
    );

    expect(fulfilResponse.result).toBeOk(Cl.uint(0));
    expect(fulfilResponse.events[1].event).toBe("stx_transfer_event");

    expect(fulfilResponse.events[1].data).toMatchObject({
      amount: order.price.toString(),
      sender: wallet2,
      recipient: wallet1,
    });
  });

  test('Unintended taker cannot fulfill active listing', () => {
    const { nftAssetContract, tokenId } = mintNft({
      deployer,
      recipient: wallet1,
    });

    const order: Order = { tokenId, expiry: 10, price: 10, taker: wallet2 };

    whitelistAssetTx(nftAssetContract, true, deployer)

    let listResponse = listOrderTx(nftAssetContract, wallet1, order)
    let listingId = listResponse.result.value

    const fulfilResponse = simnet.callPublicFn(
      contractName,
      "fulfil-listing-stx",
      [listingId, Cl.principal(nftAssetContract)],
      wallet3
    );

    expect(fulfilResponse.result).toBeErr(Cl.uint(2006));
    expect(fulfilResponse.events).toHaveLength(0);
  });
});
```

### Multiple orders

We add one final bonus test that fulfils a few random listings in a random
order. It can be useful to catch bugs that might not arise in a controller state
with one listing and one purchase.

```ts
describe("Multiple orders", () => {
  test("Can fulfil multiple active listings in any order", () => {
    const expiry = 100;

    const randomSorter = () => Math.random() - 0.5;
    
    // Take some makers and takers in random order.
    const makers = ["wallet_1", "wallet_2", "wallet_3", "wallet_4"]
      .sort(randomSorter)
      .map((name) => accounts.get(name)!);
    const takers = ["wallet_5", "wallet_6", "wallet_7", "wallet_8"]
      .sort(randomSorter)
      .map((name) => accounts.get(name)!);

    // Mint some NFTs so the IDs do not always start at zero.
    const mints = [...Array(1 + ~~(Math.random() * 10))].map(() =>
      mintNft({ deployer, recipient: deployer })
    );

    // Mint an NFT for all makers and generate orders.
    const nfts = makers.map((recipient) =>
      mintNft({ deployer, recipient })
    );

    const orders: Order[] = makers.map((maker, i) => ({
      tokenId: nfts[i].tokenId,
      expiry,
      price: 1 + ~~(Math.random() * 10),
    }));

    // Whitelist asset contract
    whitelistAssetTx(mints[0].nftAssetContract, true, deployer)

    // List all NFTs.
    let listingResponse = makers.map((maker, i) =>
      listOrderTx(nfts[i].nftAssetContract, maker, orders[i])
    )

    let orderIdUints = listingResponse.map(receipt => receipt.result.value)

    let fulfilResponse = takers.map((taker, i) =>
      simnet.callPublicFn(
        contractName,
        "fulfil-listing-stx",
        [orderIdUints[i], Cl.principal(nfts[i].nftAssetContract)],
        taker
      )
    )

    fulfilResponse.map((receipt, i) => {
      expect(receipt.result).toBeOk(orderIdUints[i])

      let nftTransferEvent = receipt.events.find(e => e.event === 'nft_transfer_event')!
      assertNftTransfer(nftTransferEvent, mints[0].nftAssetContract, nfts[i].tokenId, contractPrincipal, takers[i])

      let stxTransferEvent = receipt.events.find(e => e.event === 'stx_transfer_event')!

      expect(Cl.standardPrincipal(stxTransferEvent.data.sender)).toBePrincipal(takers[i])
    })    
  })
})
```

That was quite a lot, but there we are!
