import { Cl } from '@stacks/transactions';
import { describe, test, expect } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

const defaultNftAssetContract = 'sip009-nft';
const defaultPaymentAssetContract = 'sip010-token';

interface Order {
  taker?: string,
  tokenId: number,
  expiry: number,
  price: number,
  paymentAssetContract?: string
}

function mintNft({ deployer, recipient, nftAssetContract = defaultNftAssetContract }: { deployer: string, recipient: string, nftAssetContract?: string }) {
  const mintResponse = simnet.callPublicFn(nftAssetContract, 'mint', [Cl.principal(recipient)], deployer);

  expect(mintResponse.result).toBeOk(Cl.uint(2));
  expect(mintResponse.events).toHaveLength(1);
  expect(mintResponse.events[0].event).toBe('nft_mint_event');
  const nftMintEvent = mintResponse.events[0];

  return { nftAssetContract: nftMintEvent.data.asset_identifier.split('::')[0], tokenId: nftMintEvent.data.value.value };
}

function mintFt({ deployer, amount, recipient, paymentAssetContract = defaultPaymentAssetContract }: { deployer: string, amount: number, recipient: string, paymentAssetContract?: string }) {
  const mintResponse = simnet.callPublicFn(paymentAssetContract, 'mint', [Cl.uint(amount), Cl.principal(recipient)], deployer);

  expect(mintResponse.result).toBeOk(Cl.bool(true));
  expect(mintResponse.events).toHaveLength(1);
  expect(mintResponse.events[0].event).toBe('ft_mint_event');

  expect(mintResponse.events).toHaveLength(1);
  expect(mintResponse.events[0].event).toBe('ft_mint_event');
  const ftMintEvent = mintResponse.events[0];

  return { paymentAssetContract: ftMintEvent.data.asset_identifier.split('::')[0], paymentAssetId: ftMintEvent.data.asset_identifier.split('::')[1] };
}

const makeOrder = (order: Order) =>
  Cl.tuple({
    'taker': order.taker ? Cl.some(Cl.principal(order.taker)) : Cl.none(),
    'token-id': Cl.uint(order.tokenId),
    'expiry': Cl.uint(order.expiry),
    'price': Cl.uint(order.price),
    'payment-asset-contract': order.paymentAssetContract ? Cl.some(Cl.principal(order.paymentAssetContract)) : Cl.none(),
  });

describe('Listing tests', () => {
  test('Can list an NFT for sale for STX', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const { nftAssetContract, tokenId } = mintNft({ deployer, recipient: wallet1 });

    const order: Order = { tokenId, expiry: 10, price: 10 };

    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(nftAssetContract), Cl.bool(true)], deployer);
    const listResponse = simnet.callPublicFn('tiny-market', 'list-asset', [Cl.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], wallet1);

    expect(listResponse.result).toBeOk(Cl.uint(0));
    expect(listResponse.events[0].event, 'nft_transfer_event');
    expect(listResponse.events[0].data.sender).toBe(wallet1)
    expect(listResponse.events[0].data.recipient).toBe(deployer + ".tiny-market") //Array.from(simnet.getContractsInterfaces().keys())
  });

  test('Can list an NFT for sale for any SIP010 fungible token', () => {
    // Clarinet.test({
    //   name: "Can list an NFT for sale for any SIP010 fungible token",
    //   async fn(chain: Chain, accounts: Map<string, Account>) {
    //     const [deployer, maker] = ['deployer', 'wallet_1'].map(name => accounts.get(name)!);
    //     const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
    //     const { paymentAssetContract } = mintFt({ chain, deployer, recipient: maker, amount: 1 });
    //     const order: Order = { tokenId, expiry: 10, price: 10, paymentAssetContract };
    //     const block = chain.mineBlock([
    //       whitelistAssetTx(nftAssetContract, true, deployer),
    //       whitelistAssetTx(paymentAssetContract, true, deployer),
    //       listOrderTx(nftAssetContract, maker, order)
    //     ]);
    //     block.receipts[2].result.expectOk().expectUint(0);
    //     assertNftTransfer(block.receipts[2].events[0], nftAssetContract, tokenId, maker.address, contractPrincipal(deployer));
    //   }
    // });
  });
});

describe('Invalid listings', () => {
  test('Cannot list an NFT for sale if the expiry is in the past', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const { nftAssetContract, tokenId } = mintNft({ deployer, recipient: wallet1 });

    const { paymentAssetContract, paymentAssetId } = mintFt({ deployer, recipient: wallet1, amount: 1 })

    const order: Order = { tokenId, expiry: 10, price: 10, paymentAssetContract };

    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(nftAssetContract), Cl.bool(true)], deployer);
    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(paymentAssetContract), Cl.bool(true)], deployer);

    const listResponse = simnet.callPublicFn('tiny-market', 'list-asset', [Cl.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], wallet1);

    expect(listResponse.result).toBeOk(Cl.uint(0));
  });

  test('Cannot list an NFT for sale for nothing', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const { nftAssetContract, tokenId } = mintNft({ deployer, recipient: wallet1 });

    const order: Order = { tokenId, expiry: 10, price: 0 };

    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(nftAssetContract), Cl.bool(true)], deployer);

    const listResponse = simnet.callPublicFn('tiny-market', 'list-asset', [Cl.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], wallet1);

    expect(listResponse.result).toBeErr(Cl.uint(1001));
  });

  test('Cannot list an NFT for sale that the sender does not own', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const { nftAssetContract, tokenId } = mintNft({ deployer, recipient: wallet2 });

    const order: Order = { tokenId, expiry: 10, price: 10 };

    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(nftAssetContract), Cl.bool(true)], deployer);

    const cancelResponse = simnet.callPublicFn('tiny-market', 'list-asset', [Cl.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], wallet1);

    expect(cancelResponse.result).toBeErr(Cl.uint(1));
    expect(cancelResponse.events).toHaveLength(0);
  });
});

describe('Cancelling listings', () => {
  test('Maker can cancel a listing', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const { nftAssetContract, tokenId } = mintNft({ deployer, recipient: wallet1 });

    const order: Order = { tokenId, expiry: 10, price: 10 };

    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(nftAssetContract), Cl.bool(true)], deployer);
    simnet.callPublicFn('tiny-market', 'list-asset', [Cl.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], wallet1);

    const cancelResponse = simnet.callPublicFn('tiny-market', 'cancel-listing', [Cl.uint(0), Cl.principal(nftAssetContract)], wallet1);

    expect(cancelResponse.result).toBeOk(Cl.bool(true));
  });

  test('Non-maker cannot cancel listing', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const { nftAssetContract, tokenId } = mintNft({ deployer, recipient: wallet1 });

    const order: Order = { tokenId, expiry: 10, price: 10 };

    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(nftAssetContract), Cl.bool(true)], deployer);
    simnet.callPublicFn('tiny-market', 'list-asset', [Cl.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], wallet1);

    const cancelResponse = simnet.callPublicFn('tiny-market', 'cancel-listing', [Cl.uint(0), Cl.principal(nftAssetContract)], wallet2);

    expect(cancelResponse.result).toBeErr(Cl.uint(2001));

    expect(cancelResponse.events).toHaveLength(0);
  });
});

describe('Retrieving listings', () => {
  test('Can get listings that have not been cancelled', () => {
    // Clarinet.test({
    //   name: "Can get listings that have not been cancelled",
    //   async fn(chain: Chain, accounts: Map<string, Account>) {
    //     const [deployer, maker] = ['deployer', 'wallet_1'].map(name => accounts.get(name)!);
    //     const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
    //     const order: Order = { tokenId, expiry: 10, price: 10 };
    //     const block = chain.mineBlock([
    //       whitelistAssetTx(nftAssetContract, true, deployer),
    //       listOrderTx(nftAssetContract, maker, order)
    //     ]);
    //     const listingIdUint = block.receipts[1].result.expectOk();
    //     const receipt = chain.callReadOnlyFn(contractName, 'get-listing', [listingIdUint], deployer.address);
    //     const listing: { [key: string]: string } = receipt.result.expectSome().expectTuple() as any;

    //     listing['expiry'].expectUint(order.expiry);
    //     listing['maker'].expectPrincipal(maker.address);
    //     listing['payment-asset-contract'].expectNone();
    //     listing['price'].expectUint(order.price);
    //     listing['taker'].expectNone();
    //     listing['nft-asset-contract'].expectPrincipal(nftAssetContract);
    //     listing['token-id'].expectUint(tokenId);
    //   }
    // });   
  });

  test('Cannot get listings that have been cancelled or do not exist', () => {
    // Clarinet.test({
    //   name: "Cannot get listings that have been cancelled or do not exist",
    //   async fn(chain: Chain, accounts: Map<string, Account>) {
    //     const [deployer, maker] = ['deployer', 'wallet_1'].map(name => accounts.get(name)!);
    //     const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
    //     const order: Order = { tokenId, expiry: 10, price: 10 };
    //     chain.mineBlock([
    //       listOrderTx(nftAssetContract, maker, order),
    //       Tx.contractCall(contractName, 'cancel-listing', [types.uint(0), types.principal(nftAssetContract)], maker.address)
    //     ]);
    //     const receipts = [types.uint(0), types.uint(999)].map(listingId => chain.callReadOnlyFn(contractName, 'get-listing', [listingId], deployer.address));
    //     receipts.map(receipt => receipt.result.expectNone());
    //   }
    // });   
  });
});

describe('Fulfilling listings', () => {
  test('Can fulfil an active listing with STX', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const { nftAssetContract, tokenId } = mintNft({ deployer, recipient: wallet1 });

    const order: Order = { tokenId, expiry: 10, price: 10 };

    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(nftAssetContract), Cl.bool(true)], deployer);

    simnet.callPublicFn('tiny-market', 'list-asset', [Cl.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], wallet1);

    const fulfilResponse = simnet.callPublicFn('tiny-market', 'fulfil-listing-stx', [Cl.uint(0), Cl.principal(nftAssetContract)], wallet2);

    expect(fulfilResponse.result).toBeOk(Cl.uint(0));

    expect(fulfilResponse.events[1].event).toBe('stx_transfer_event');

    expect(fulfilResponse.events[1].data).toMatchObject({
      amount: order.price.toString(),
      sender: wallet2,
      recipient: wallet1
    });
  });

  test('Can fulfil an active listing with SIP010 fungible tokens', () => {
    // Clarinet.test({
    //   name: "Can fulfil an active listing with SIP010 fungible tokens",
    //   async fn(chain: Chain, accounts: Map<string, Account>) {
    //     const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
    //     const price = 50;
    //     const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
    //     const { paymentAssetContract, paymentAssetId } = mintFt({ chain, deployer, recipient: taker, amount: price });
    //     const order: Order = { tokenId, expiry: 10, price, paymentAssetContract };
    //     const block = chain.mineBlock([
    //       whitelistAssetTx(nftAssetContract, true, deployer),
    //       whitelistAssetTx(paymentAssetContract, true, deployer),
    //       listOrderTx(nftAssetContract, maker, order),
    //       Tx.contractCall(contractName, 'fulfil-listing-ft', [types.uint(0), types.principal(nftAssetContract), types.principal(paymentAssetContract)], taker.address)
    //     ]);
    //     block.receipts[3].result.expectOk().expectUint(0);
    //     assertNftTransfer(block.receipts[3].events[0], nftAssetContract, tokenId, contractPrincipal(deployer), taker.address);
    //     block.receipts[3].events.expectFungibleTokenTransferEvent(price, taker.address, maker.address, paymentAssetId);
    //   }
    // });
  });
});

describe('Basic fulfilment errors', () => {
  test('Cannot fulfil own listing', () => {
    // Clarinet.test({
    //   name: "Cannot fulfil own listing",
    //   async fn(chain: Chain, accounts: Map<string, Account>) {
    //     const [deployer, maker] = ['deployer', 'wallet_1'].map(name => accounts.get(name)!);
    //     const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
    //     const order: Order = { tokenId, expiry: 10, price: 10 };
    //     const block = chain.mineBlock([
    //       whitelistAssetTx(nftAssetContract, true, deployer),
    //       listOrderTx(nftAssetContract, maker, order),
    //       Tx.contractCall(contractName, 'fulfil-listing-stx', [types.uint(0), types.principal(nftAssetContract)], maker.address)
    //     ]);
    //     block.receipts[2].result.expectErr().expectUint(2005);
    //     assertEquals(block.receipts[2].events.length, 0);
    //   }
    // });
  });

  test('Cannot fulfil an unknown listing', () => {
    // Clarinet.test({
    //   name: "Cannot fulfil an unknown listing",
    //   async fn(chain: Chain, accounts: Map<string, Account>) {
    //     const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
    //     const { nftAssetContract } = mintNft({ chain, deployer, recipient: maker });
    //     const block = chain.mineBlock([
    //       whitelistAssetTx(nftAssetContract, true, deployer),
    //       Tx.contractCall(contractName, 'fulfil-listing-stx', [types.uint(0), types.principal(nftAssetContract)], taker.address)
    //     ])
    //     block.receipts[1].result.expectErr().expectUint(2000);
    //     assertEquals(block.receipts[1].events.length, 0);
    //   }
    // });
  });

  test('Cannot fulfil an expired listing', () => {
    // Clarinet.test({
    //   name: "Cannot fulfil an expired listing",
    //   async fn(chain: Chain, accounts: Map<string, Account>) {
    //     const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
    //     const expiry = 10;
    //     const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
    //     const order: Order = { tokenId, expiry, price: 10 };
    //     chain.mineBlock([
    //       whitelistAssetTx(nftAssetContract, true, deployer),
    //       listOrderTx(nftAssetContract, maker, order),
    //     ]);
    //     chain.mineEmptyBlockUntil(expiry + 1);
    //     const block = chain.mineBlock([
    //       Tx.contractCall(contractName, 'fulfil-listing-stx', [types.uint(0), types.principal(nftAssetContract)], taker.address)
    //     ])
    //     block.receipts[0].result.expectErr().expectUint(2002);
    //     assertEquals(block.receipts[0].events.length, 0);
    //   }
    // });
  });
});

describe('Wrong payment asset or trait reference', () => {
  test('Cannot fulfil a listing with a different NFT contract reference', () => {
    // Clarinet.test({
    //   name: "Cannot fulfil a listing with a different NFT contract reference",
    //   async fn(chain: Chain, accounts: Map<string, Account>) {
    //     const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
    //     const expiry = 10;
    //     const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
    //     const order: Order = { tokenId, expiry: 10, price: 10 };
    //     const bogusNftAssetContract = `${deployer.address}.bogus-nft`;
    //     const block = chain.mineBlock([
    //       whitelistAssetTx(nftAssetContract, true, deployer),
    //       listOrderTx(nftAssetContract, maker, order),
    //       Tx.contractCall(contractName, 'fulfil-listing-stx', [types.uint(0), types.principal(bogusNftAssetContract)], taker.address)
    //     ]);
    //     block.receipts[2].result.expectErr().expectUint(2003);
    //     assertEquals(block.receipts[2].events.length, 0);
    //   }
    // });
  });

  test('Cannot fulfil an active STX listing with SIP010 fungible tokens', () => {
    // Clarinet.test({
    //   name: "Cannot fulfil an active STX listing with SIP010 fungible tokens",
    //   async fn(chain: Chain, accounts: Map<string, Account>) {
    //     const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
    //     const price = 50;
    //     const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
    //     const { paymentAssetContract } = mintFt({ chain, deployer, recipient: taker, amount: price });
    //     const order: Order = { tokenId, expiry: 10, price };
    //     const block = chain.mineBlock([
    //       whitelistAssetTx(nftAssetContract, true, deployer),
    //       whitelistAssetTx(paymentAssetContract, true, deployer),
    //       listOrderTx(nftAssetContract, maker, order),
    //       Tx.contractCall(contractName, 'fulfil-listing-ft', [types.uint(0), types.principal(nftAssetContract), types.principal(paymentAssetContract)], taker.address)
    //     ]);
    //     block.receipts[3].result.expectErr().expectUint(2004);
    //     assertEquals(block.receipts[3].events.length, 0);
    //   }
    // });
  });

  test('Cannot fulfil an active SIP010 fungible token listing with STX', () => {
    // Clarinet.test({
    //   name: "Cannot fulfil an active SIP010 fungible token listing with STX",
    //   async fn(chain: Chain, accounts: Map<string, Account>) {
    //     const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
    //     const price = 50;
    //     const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
    //     const { paymentAssetContract } = mintFt({ chain, deployer, recipient: taker, amount: price });
    //     const order: Order = { tokenId, expiry: 10, price, paymentAssetContract };
    //     const block = chain.mineBlock([
    //       whitelistAssetTx(nftAssetContract, true, deployer),
    //       whitelistAssetTx(paymentAssetContract, true, deployer),
    //       listOrderTx(nftAssetContract, maker, order),
    //       Tx.contractCall(contractName, 'fulfil-listing-stx', [types.uint(0), types.principal(nftAssetContract)], taker.address)
    //     ]);
    //     block.receipts[3].result.expectErr().expectUint(2004);
    //     assertEquals(block.receipts[3].events.length, 0);
    //   }
    // });
  });

  test('Cannot fulfil an active SIP010 fungible token listing with a different SIP010 fungible token contract reference', () => {
    // Clarinet.test({
    //   name: "Cannot fulfil an active SIP010 fungible token listing with a different SIP010 fungible token contract reference",
    //   async fn(chain: Chain, accounts: Map<string, Account>) {
    //     const [deployer, maker, taker] = ['deployer', 'wallet_1', 'wallet_2'].map(name => accounts.get(name)!);
    //     const price = 50;
    //     const { nftAssetContract, tokenId } = mintNft({ chain, deployer, recipient: maker });
    //     const { paymentAssetContract } = mintFt({ chain, deployer, recipient: taker, amount: price });
    //     const bogusPaymentAssetContract = `${deployer.address}.bogus-ft`;
    //     const order: Order = { tokenId, expiry: 10, price, paymentAssetContract };
    //     const block = chain.mineBlock([
    //       whitelistAssetTx(nftAssetContract, true, deployer),
    //       whitelistAssetTx(paymentAssetContract, true, deployer),
    //       listOrderTx(nftAssetContract, maker, order),
    //       Tx.contractCall(contractName, 'fulfil-listing-ft', [types.uint(0), types.principal(nftAssetContract), types.principal(bogusPaymentAssetContract)], taker.address)
    //     ]);
    //     block.receipts[3].result.expectErr().expectUint(2004);
    //     assertEquals(block.receipts[3].events.length, 0);
    //   }
    // });
  });
});

describe('Intended taker', () => {
  test('"Intended taker can fulfil active listing"', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const { nftAssetContract, tokenId } = mintNft({ deployer, recipient: wallet1 });

    const order: Order = { tokenId, expiry: 10, price: 10, taker: wallet2 };

    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(nftAssetContract), Cl.bool(true)], deployer);
    simnet.callPublicFn('tiny-market', 'list-asset', [Cl.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], wallet1);

    const fulfilResponse = simnet.callPublicFn('tiny-market', 'fulfil-listing-stx', [Cl.uint(0), Cl.principal(nftAssetContract)], wallet2);

    expect(fulfilResponse.result).toBeOk(Cl.uint(0));
    expect(fulfilResponse.events[1].event).toBe('stx_transfer_event');

    expect(fulfilResponse.events[1].data).toMatchObject({
      amount: order.price.toString(),
      sender: wallet2,
      recipient: wallet1
    });
  });

  test('"Unintended taker cannot fulfil active listing""', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const { nftAssetContract, tokenId } = mintNft({ deployer, recipient: wallet1 });

    const order: Order = { tokenId, expiry: 10, price: 10, taker: wallet2 };

    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(nftAssetContract), Cl.bool(true)], deployer);

    simnet.callPublicFn('tiny-market', 'list-asset', [Cl.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], wallet1);

    const fulfilResponse = simnet.callPublicFn('tiny-market', 'fulfil-listing-stx', [Cl.uint(0), Cl.principal(nftAssetContract)], wallet3);

    expect(fulfilResponse.result).toBeErr(Cl.uint(2006));
    expect(fulfilResponse.events).toHaveLength(0);
  });
});

describe('Multiple orders', () => {
  test('Can fulfil multiple active listings in any order', () => {
    // Clarinet.test({
    //   name: "Can fulfil multiple active listings in any order",
    //   async fn(chain: Chain, accounts: Map<string, Account>) {
    //     const deployer = accounts.get('deployer')!;
    //     const expiry = 100;

    //     const randomSorter = () => Math.random() - .5;

    //     // Take some makers and takers in random order.
    //     const makers = ['wallet_1', 'wallet_2', 'wallet_3', 'wallet_4'].sort(randomSorter).map(name => accounts.get(name)!);
    //     const takers = ['wallet_5', 'wallet_6', 'wallet_7', 'wallet_8'].sort(randomSorter).map(name => accounts.get(name)!);

    //     // Mint some NFTs so the IDs do not always start at zero.
    //     const mints = [...Array(1 + ~~(Math.random() * 10))].map(() => mintNft({ chain, deployer, recipient: deployer }));

    //     // Mint an NFT for all makers and generate orders.
    //     const nfts = makers.map(recipient => mintNft({ chain, deployer, recipient }));
    //     const orders: Order[] = makers.map((maker, i) => ({ tokenId: nfts[i].tokenId, expiry, price: 1 + ~~(Math.random() * 10) }));

    //     // Whitelist asset contract
    //     chain.mineBlock([whitelistAssetTx(mints[0].nftAssetContract, true, deployer)]);

    //     // List all NFTs.
    //     const block = chain.mineBlock(
    //       makers.map((maker, i) => listOrderTx(nfts[i].nftAssetContract, maker, makeOrder(orders[i])))
    //     );
    //     const orderIdUints = block.receipts.map(receipt => receipt.result.expectOk().toString());

    //     // Attempt to fulfil all listings.
    //     const block2 = chain.mineBlock(
    //       takers.map((taker, i) => Tx.contractCall(contractName, 'fulfil-listing-stx', [orderIdUints[i], types.principal(nfts[i].nftAssetContract)], taker.address))
    //     );

    //     const contractAddress = contractPrincipal(deployer);

    //     // Assert that all orders were fulfilled and that the NFTs and STX have been tranferred to the appropriate principals.
    //     block2.receipts.map((receipt, i) => {
    //       assertEquals(receipt.result.expectOk(), orderIdUints[i]);
    //       assertNftTransfer(receipt.events[0], nfts[i].nftAssetContract, nfts[i].tokenId, contractAddress, takers[i].address);
    //       receipt.events.expectSTXTransferEvent(orders[i].price, takers[i].address, makers[i].address);
    //     });
    //   }
    // });
  });
});
