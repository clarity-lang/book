import { Cl } from '@stacks/transactions';
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

const defaultNftAssetContract = 'sip009-nft';
const defaultPaymentAssetContract = 'sip010-token';


function mintNft({deployer, recipient, nftAssetContract = defaultNftAssetContract }: {deployer: string, recipient: string, nftAssetContract?: string }) {
	const mintResponse = simnet.callPublicFn(nftAssetContract, 'mint', [Cl.principal(recipient)], deployer);
	
  expect(mintResponse.result).toBeOk(Cl.uint(2));
  expect(mintResponse.events).toHaveLength(1);
  expect(mintResponse.events[0].event).toBe('nft_mint_event');
  const nftMintEvent = mintResponse.events[0];

	return {nftAssetContract: nftMintEvent.data.asset_identifier.split('::')[0], tokenId: nftMintEvent.data.value.value};
}

function mintFt({deployer, amount, recipient, paymentAssetContract = defaultPaymentAssetContract }: {deployer: string, amount: number, recipient: string, paymentAssetContract?: string }) {
  const mintResponse = simnet.callPublicFn(paymentAssetContract, 'mint', [Cl.uint(amount), Cl.principal(recipient)], deployer);
	
  expect(mintResponse.result).toBeOk(Cl.bool(true));
  expect(mintResponse.events).toHaveLength(1);
  expect(mintResponse.events[0].event).toBe('ft_mint_event');

  expect(mintResponse.events).toHaveLength(1);
  expect(mintResponse.events[0].event).toBe('ft_mint_event');
  const ftMintEvent = mintResponse.events[0];

	return {paymentAssetContract: ftMintEvent.data.asset_identifier.split('::')[0], paymentAssetId: ftMintEvent.data.asset_identifier.split('::')[1]};
}

const makeOrder = (order: Order) =>
	Cl.tuple({
		'taker': order.taker ? Cl.some(Cl.principal(order.taker)) : Cl.none(),
		'token-id': Cl.uint(order.tokenId),
		'expiry': Cl.uint(order.expiry),
		'price': Cl.uint(order.price),
		'payment-asset-contract': order.paymentAssetContract ? Cl.some(Cl.principal(order.paymentAssetContract)) : Cl.none(),
	});


interface Order {
	taker?: string,
	tokenId: number,
	expiry: number,
	price: number,
	paymentAssetContract?: string
}

describe('test `allow_list_nft', () => {
  it('Can list an NFT for sale for STX', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const {nftAssetContract, tokenId} = mintNft({deployer, recipient: wallet1 });


    const order: Order = {tokenId, expiry: 10, price: 10};

    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(nftAssetContract), Cl.bool(true)], deployer);
    const listResponse = simnet.callPublicFn('tiny-market', 'list-asset', [Cl.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], wallet1);
 
    expect(listResponse.result).toBeOk(Cl.uint(0));
    expect(listResponse.events[0].event, 'nft_transfer_event');
    expect(listResponse.events[0].data.sender).toBe(wallet1)
    expect(listResponse.events[0].data.recipient).toBe(deployer + ".tiny-market") //Array.from(simnet.getContractsInterfaces().keys())
  });
})

describe('test `denied_list_nft_expired', () => {
  it('Cannot list an NFT for sale if the expiry is in the past', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const {nftAssetContract, tokenId} = mintNft({deployer, recipient: wallet1 });

    const {paymentAssetContract, paymentAssetId } = mintFt({deployer, recipient: wallet1, amount: 1})

    const order: Order = {tokenId, expiry: 10, price: 10, paymentAssetContract};

    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(nftAssetContract), Cl.bool(true)], deployer);
    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(paymentAssetContract), Cl.bool(true)], deployer);
  
    const listResponse = simnet.callPublicFn('tiny-market', 'list-asset', [Cl.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], wallet1);
 
    expect(listResponse.result).toBeOk(Cl.uint(0));
  });
})

describe('test `denied_list_nft_nothing', () => {
  it('Cannot list an NFT for sale for nothing', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const {nftAssetContract, tokenId} = mintNft({deployer, recipient: wallet1 });

    const order: Order = {tokenId, expiry: 10, price: 0};

    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(nftAssetContract), Cl.bool(true)], deployer);

    const listResponse = simnet.callPublicFn('tiny-market', 'list-asset', [Cl.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], wallet1);
 
    expect(listResponse.result).toBeErr(Cl.uint(1001));
  });
})

describe('test `denied_list_nft_not_owner', () => {
  it('Cannot list an NFT for sale that the sender does not own', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const {nftAssetContract, tokenId} = mintNft({deployer, recipient: wallet2 });

    const order: Order = {tokenId, expiry: 10, price: 10};

    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(nftAssetContract), Cl.bool(true)], deployer);

    const cancelResponse = simnet.callPublicFn('tiny-market', 'list-asset', [Cl.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], wallet1);
 
    expect(cancelResponse.result).toBeErr(Cl.uint(1));

    expect(cancelResponse.events).toHaveLength(0);
  });
})

describe('test `cancel_listing', () => {
  it('Maker can cancel a listing', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const {nftAssetContract, tokenId} = mintNft({deployer, recipient: wallet1 });

    const order: Order = {tokenId, expiry: 10, price: 10};

    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(nftAssetContract), Cl.bool(true)], deployer);

    simnet.callPublicFn('tiny-market', 'list-asset', [Cl.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], wallet1);
 
    const cancelResponse = simnet.callPublicFn('tiny-market', 'cancel-listing', [Cl.uint(0), Cl.principal(nftAssetContract)], wallet1);
 
    expect(cancelResponse.result).toBeOk(Cl.bool(true));
  });
})

describe('test `cancel_listing_non_maker', () => {
  it('Non-maker cannot cancel listing', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const {nftAssetContract, tokenId} = mintNft({deployer, recipient: wallet1 });

    const order: Order = {tokenId, expiry: 10, price: 10};

    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(nftAssetContract), Cl.bool(true)], deployer);

    simnet.callPublicFn('tiny-market', 'list-asset', [Cl.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], wallet1);

    const cancelResponse = simnet.callPublicFn('tiny-market', 'cancel-listing', [Cl.uint(0), Cl.principal(nftAssetContract)], wallet2);
 
    expect(cancelResponse.result).toBeErr(Cl.uint(2001));

    expect(cancelResponse.events).toHaveLength(0);
  });
})

describe('test `Fulfil_listing_stx', () => {
  it('Can fulfil an active listing with STX', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const {nftAssetContract, tokenId} = mintNft({deployer, recipient: wallet1 });

    const order: Order = {tokenId, expiry: 10, price: 10};

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
})

describe('test `Deny_taker_listing', () => {
  it('"Intended taker can fulfil active listing"', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const {nftAssetContract, tokenId} = mintNft({deployer, recipient: wallet1 });
 
    const order: Order = {tokenId, expiry: 10, price: 10, taker: wallet2};

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
})

describe('test `Deny_fulfil_listing', () => {
  it('"Unintended taker cannot fulfil active listing""', () => {
    simnet.callPublicFn(defaultNftAssetContract, 'mint', [Cl.principal(deployer)], deployer);
    const {nftAssetContract, tokenId} = mintNft({deployer, recipient: wallet1 });
 
    const order: Order = {tokenId, expiry: 10, price: 10, taker: wallet2};

    simnet.callPublicFn('tiny-market', 'set-whitelisted', [Cl.principal(nftAssetContract), Cl.bool(true)], deployer);

    simnet.callPublicFn('tiny-market', 'list-asset', [Cl.principal(nftAssetContract), typeof order === 'string' ? order : makeOrder(order)], wallet1);

    const fulfilResponse = simnet.callPublicFn('tiny-market', 'fulfil-listing-stx', [Cl.uint(0), Cl.principal(nftAssetContract)], wallet3);
 
    expect(fulfilResponse.result).toBeErr(Cl.uint(2006));

    expect(fulfilResponse.events).toHaveLength(0);
  });
})