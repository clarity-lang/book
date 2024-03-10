import { Cl } from '@stacks/transactions';
import { describe, expect, test } from "vitest";

const accounts = simnet.getAccounts();

describe('Testing lock', () => {
  test('Allows the contract owner to lock an amount', () => {
    const deployer = accounts.get("deployer")!;
    const beneficiary = accounts.get("wallet_1")!;
    const amount = 10;

    const lockResponse = simnet.callPublicFn(
      'timelocked-wallet', 'lock',
      [Cl.principal(beneficiary), Cl.uint(10), Cl.uint(amount)],
      deployer
    );

    // The lock should be successful.
    expect(lockResponse.result).toBeOk(Cl.bool(true));

    // There should be a STX transfer of the amount specified.
    expect(lockResponse.events).toHaveLength(1);
    expect(lockResponse.events[0].event).toBe('stx_transfer_event');

    expect(lockResponse.events[0].data).toMatchObject({
      amount: amount.toString(),
      sender: deployer,
      recipient: `${deployer}.timelocked-wallet`,
    });
  });

  test('Does not allow anyone else to lock an amount', () => {
    const accountA = accounts.get("wallet_1")!;
    const beneficiary = accounts.get("wallet_2")!;

    const lockResponse = simnet.callPublicFn(
      'timelocked-wallet', 'lock',
      [Cl.principal(beneficiary), Cl.uint(10), Cl.uint(10)],
      accountA
    );

    // Should return err-owner-only (err u100).
    expect(lockResponse.result).toBeErr(Cl.uint(100));
  });

  test('Cannot lock more than once', () => {
    const deployer = accounts.get("deployer")!;
    const beneficiary = accounts.get("wallet_1")!;
    const unlockAt = 10;
    const amount = 10;

    const lockResponse1 = simnet.callPublicFn(
      'timelocked-wallet', 'lock',
      [Cl.principal(beneficiary), Cl.uint(unlockAt), Cl.uint(amount)],
      deployer
    );
    const lockResponse2 = simnet.callPublicFn(
      'timelocked-wallet', 'lock',
      [Cl.principal(beneficiary), Cl.uint(unlockAt), Cl.uint(amount)],
      deployer
    );

    // The first lock worked and STX were transferred.
    expect(lockResponse1.result).toBeOk(Cl.bool(true));
    expect(lockResponse1.events).toHaveLength(1);
    expect(lockResponse1.events[0].event).toBe('stx_transfer_event');

    expect(lockResponse1.events[0].data).toMatchObject({
      amount: amount.toString(),
      sender: deployer,
      recipient: `${deployer}.timelocked-wallet`
    });

    // The second lock fails with err-already-locked (err u101).
    expect(lockResponse2.result).toBeErr(Cl.uint(101));

    // Assert there are no transfer events.
    expect(lockResponse2.events).toHaveLength(0);
  });

  test('Unlock height cannot be in the past', () => {
    const deployer = accounts.get("deployer")!;
    const beneficiary = accounts.get("wallet_1")!;
    const amount = 10;
    const targetBlockHeight = 10;

    // Advance the chain until the unlock height plus one.
    simnet.mineEmptyBlocks(targetBlockHeight + 1);

    const lockResponse = simnet.callPublicFn(
      'timelocked-wallet', 'lock',
      [Cl.principal(beneficiary), Cl.uint(targetBlockHeight), Cl.uint(amount)],
      deployer
    );

    // The lock fails with err-unlock-in-past (err u102).
    expect(lockResponse.result).toBeErr(Cl.uint(102));

    // Assert there are no transfer events.
    expect(lockResponse.events).toHaveLength(0);
  });
});

describe('Testing bestow', () => {
  test('Allows the beneficiary to bestow the right to claim to someone else', () => {
    const deployer = accounts.get("deployer")!;
    const beneficiary = accounts.get("wallet_1")!;
    const newBeneficiary = accounts.get("wallet_2")!;

    const lockResponse = simnet.callPublicFn(
      'timelocked-wallet', 'lock',
      [Cl.principal(beneficiary), Cl.uint(10), Cl.uint(10)],
      deployer
    );
    const bestowResponse = simnet.callPublicFn(
      'timelocked-wallet', 'bestow',
      [Cl.principal(newBeneficiary)],
      beneficiary
    );

    expect(lockResponse.result).toBeOk(Cl.bool(true));
    expect(bestowResponse.result).toBeOk(Cl.bool(true));
  });

  test('Does not allow anyone else to bestow the right to claim to someone else (not even the contract owner)', () => {
    const deployer = accounts.get("deployer")!;
    const beneficiary = accounts.get("wallet_1")!;
    const accountA = accounts.get("wallet_2")!;

    const lockResponse = simnet.callPublicFn(
      'timelocked-wallet', 'lock',
      [Cl.principal(beneficiary), Cl.uint(10), Cl.uint(10)],
      deployer
    );
    const bestowResponse1 = simnet.callPublicFn(
      'timelocked-wallet', 'bestow',
      [Cl.principal(deployer)],
      deployer
    );
    const bestowResponse2 = simnet.callPublicFn(
      'timelocked-wallet', 'bestow',
      [Cl.principal(accountA)],
      accountA
    );

    // All but the first call fails with err-beneficiary-only (err u104).
    expect(lockResponse.result).toBeOk(Cl.bool(true));
    expect(bestowResponse1.result).toBeErr(Cl.uint(104));
    expect(bestowResponse2.result).toBeErr(Cl.uint(104));
  });
});

describe('Testing claim', () => {
  test('Allows the beneficiary to claim the balance when the block-height is reached', () => {
    const deployer = accounts.get("deployer")!;
    const beneficiary = accounts.get("wallet_1")!;
    const targetBlockHeight = 10;
    const amount = 10;

    simnet.callPublicFn(
      'timelocked-wallet', 'lock',
      [Cl.principal(beneficiary), Cl.uint(targetBlockHeight), Cl.uint(amount)],
      deployer
    );

    // Advance the chain until the unlock height.
    simnet.mineEmptyBlocks(targetBlockHeight);

    const claimResponse = simnet.callPublicFn('timelocked-wallet', 'claim', [], beneficiary);

    // The claim was successful and the STX were transferred.
    expect(claimResponse.result).toBeOk(Cl.bool(true));

    expect(claimResponse.events[0].data).toMatchObject({
      amount: amount.toString(),
      sender: `${deployer}.timelocked-wallet`,
      recipient: beneficiary
    });
  });

  test('Does not allow the beneficiary to claim the balance before the block-height is reached', () => {
    const deployer = accounts.get("deployer")!;
    const beneficiary = accounts.get("wallet_1")!;
    const targetBlockHeight = 10;
    const amount = 10;

    simnet.callPublicFn(
      'timelocked-wallet', 'lock',
      [Cl.principal(beneficiary), Cl.uint(targetBlockHeight), Cl.uint(amount)],
      deployer
    );

    // Advance the chain until the unlock height minus one.
    simnet.mineEmptyBlocks(targetBlockHeight - 4);

    const claimResponse = simnet.callPublicFn('timelocked-wallet', 'claim', [], beneficiary);

    // Should return err-unlock-height-not-reached (err u105).
    expect(claimResponse.result).toBeErr(Cl.uint(105));
    expect(claimResponse.events).toHaveLength(0);
  });

  test('Does not allow anyone else to claim the balance when the block-height is reached', () => {
    const deployer = accounts.get("deployer")!;
    const beneficiary = accounts.get("wallet_1")!;
    const other = accounts.get("wallet_2")!;
    const targetBlockHeight = 10;
    const amount = 10;

    simnet.callPublicFn(
      'timelocked-wallet', 'lock',
      [Cl.principal(beneficiary), Cl.uint(targetBlockHeight), Cl.uint(amount)],
      deployer
    );

    // Advance the chain until the unlock height.
    simnet.mineEmptyBlocks(targetBlockHeight);

    const claimResponse = simnet.callPublicFn('timelocked-wallet', 'claim', [], other);

    // Should return err-beneficiary-only (err u104).
    expect(claimResponse.result).toBeErr(Cl.uint(104));
    expect(claimResponse.events).toHaveLength(0);
  });
});