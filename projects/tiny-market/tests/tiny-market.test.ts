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