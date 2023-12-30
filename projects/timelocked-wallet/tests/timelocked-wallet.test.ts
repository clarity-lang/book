import { Cl } from '@stacks/transactions';
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const amount = 10;
const beneficiary1 = accounts.get("wallet_1")!;
const beneficiary2 = accounts.get("wallet_2")!;
const beneficiary3 = accounts.get('wallet_3')!;
const contractAddresses = Array.from(simnet.getContractsInterfaces().keys());


describe('test `allow_owner_lock` public function', () => {
  it('Allows the contract owner to lock an amount', () => {
    const lockResponse = simnet.callPublicFn('timelocked-wallet', 'lock', [Cl.principal(beneficiary1), Cl.uint(amount), Cl.uint(amount)], deployer);
    expect(lockResponse.result).toBeOk(Cl.bool(true));
  });

  it('sends a print event', () => {
    const lockResponse = simnet.callPublicFn('timelocked-wallet', 'lock', [Cl.principal(beneficiary1), Cl.uint(amount), Cl.uint(amount)], deployer);
    expect(lockResponse.events).toHaveLength(1);
    expect(lockResponse.events[0].event).toBe('stx_transfer_event');

    expect(lockResponse.events[0].data).toMatchObject({
      amount: "10",
      sender: deployer,
      recipient: contractAddresses[1]  //recipient: simnet.deployer + ".timelocked-wallet",
    });
  });
});

describe('test `block_unknown_lock` public function', () => {
  it('Does not allow anyone else to lock an amount', () => {
    const lockResponse = simnet.callPublicFn('timelocked-wallet', 'lock', [Cl.principal(beneficiary2), Cl.uint(10), Cl.uint(10)], beneficiary1);
    
    // Should return err-owner-only (err u100).
    expect(lockResponse.result).toBeErr(Cl.uint(100));
  });
});




describe('test `block_multiple_lock` public function', () => {
  it('Cannot lock more than once', () => {
    const lockResponse1 = simnet.callPublicFn('timelocked-wallet', 'lock', [Cl.principal(beneficiary1), Cl.uint(amount), Cl.uint(amount)], deployer);
    const lockResponse2 = simnet.callPublicFn('timelocked-wallet', 'lock', [Cl.principal(beneficiary1), Cl.uint(amount), Cl.uint(amount)], deployer);

    expect(lockResponse1.result).toBeOk(Cl.bool(true));
    expect(lockResponse1.events).toHaveLength(1); 
    expect(lockResponse1.events[0].event).toBe('stx_transfer_event');

    expect(lockResponse1.events[0].data).toMatchObject({
      amount: "10",
      sender: deployer,
      recipient: contractAddresses[1] ,//recipient: simnet.deployer + ".timelocked-wallet",
    });

    // The second lock fails with err-already-locked (err u101).
    expect(lockResponse2.result).toBeErr(Cl.uint(101));
    // Assert there are no transfer events.
    expect(lockResponse2.events).toHaveLength(0);
  });
});


describe('test `block_height_past` public function', () => {
  it('Unlock height cannot be in the past', () => {
    const targetBlockHeight = 10;

    // Advance the chain until the unlock height plus one.
    simnet.mineEmptyBlocks(targetBlockHeight + 1);
    const lockResponse = simnet.callPublicFn('timelocked-wallet', 'lock', [Cl.principal(beneficiary1), Cl.uint(targetBlockHeight), Cl.uint(amount)], deployer);
    
    // The lock fails with err-unlock-in-past (err u102).
    expect(lockResponse.result).toBeErr(Cl.uint(102));

    // Assert there are no transfer events.
    expect(lockResponse.events).toHaveLength(0);
  });
});

describe('test `Allow_bestow` public function', () => {
  it('Allows the beneficiary to bestow the right to claim to someone else', () => {
    const lockResponse = simnet.callPublicFn('timelocked-wallet', 'lock', [Cl.principal(beneficiary1), Cl.uint(amount), Cl.uint(amount)], deployer);
    const bestowResponse = simnet.callPublicFn('timelocked-wallet', 'bestow', [Cl.principal(beneficiary2)], beneficiary1);
  
    expect(lockResponse.result).toBeOk(Cl.bool(true));
    expect(bestowResponse.result).toBeOk(Cl.bool(true));
  });
});

describe('test `Deny_bestow` public function', () => {
  it('Does not allow anyone else to bestow the right to claim to someone else (not even the contract owner)', () => {
    const lockResponse = simnet.callPublicFn('timelocked-wallet', 'lock', [Cl.principal(beneficiary1), Cl.uint(amount), Cl.uint(amount)], deployer);
    const bestowResponse1 = simnet.callPublicFn('timelocked-wallet', 'bestow', [Cl.principal(deployer)], deployer);
    const bestowResponse2 = simnet.callPublicFn('timelocked-wallet', 'bestow', [Cl.principal(beneficiary3)], beneficiary3);

    expect(lockResponse.result).toBeOk(Cl.bool(true));
    expect(bestowResponse1.result).toBeErr(Cl.uint(104));
    expect(bestowResponse2.result).toBeErr(Cl.uint(104));
  });
});

describe('test `Allow_claim_height` public function', () => {
  it('Allows the beneficiary to claim the balance when the block-height is reached', () => {
    const targetBlockHeight = 10;

    const lockResponse = simnet.callPublicFn('timelocked-wallet', 'lock', [Cl.principal(beneficiary1), Cl.uint(targetBlockHeight), Cl.uint(amount)], deployer);

    // Advance the chain until the unlock height.
    simnet.mineEmptyBlocks(targetBlockHeight);

    simnet.callPublicFn('timelocked-wallet', 'claim', [], beneficiary1);

    expect(lockResponse.result).toBeOk(Cl.bool(true));

    expect(lockResponse.events[0].data).toMatchObject({
      amount: "10",
      sender: deployer,
      recipient: contractAddresses[1] , //recipient: simnet.deployer + ".timelocked-wallet",
    });
  });
});

describe('test `Deny_claim_before_height` public function', () => {
  it('Does not allow the beneficiary to claim the balance before the block-height is reached', () => {
    const targetBlockHeight = 10;

    simnet.callPublicFn('timelocked-wallet', 'lock', [Cl.principal(beneficiary1), Cl.uint(targetBlockHeight), Cl.uint(amount)], deployer);

    // Advance the chain until the unlock height minus one.
    const newHeight = simnet.mineEmptyBlocks(targetBlockHeight - 4);

    const claimResponse = simnet.callPublicFn('timelocked-wallet', 'claim', [], beneficiary1);

    console.log("New Height: " + newHeight);
    console.log("Blockheight: " + simnet.blockHeight);
    console.log("unlock-height: " + simnet.getDataVar('timelocked-wallet', 'unlock-height'))

    expect(claimResponse.result).toBeErr(Cl.uint(105));
    expect(claimResponse.events).toHaveLength(0);
  });
});

describe('test `Deny_claim_height` public function', () => {
  it('Does not allow anyone else to claim the balance when the block-height is reached', () => {
    const targetBlockHeight = 10;

    simnet.callPublicFn('timelocked-wallet', 'lock', [Cl.principal(beneficiary1), Cl.uint(targetBlockHeight), Cl.uint(amount)], deployer);

    simnet.mineEmptyBlocks(targetBlockHeight);

    const claimResponse = simnet.callPublicFn('timelocked-wallet', 'claim', [], beneficiary2);

    expect(claimResponse.result).toBeErr(Cl.uint(104));
    expect(claimResponse.events).toHaveLength(0);
    console.log(claimResponse.events);
  });
});