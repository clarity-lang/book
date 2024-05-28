import { Cl } from '@stacks/transactions';
import { expect, test } from 'vitest';

const accounts = simnet.getAccounts();

test('get-count returns u0 for principals that never called count-up before', () => {
  // Get the deployer account.
  const deployer = accounts.get('deployer')!;

  // Call the get-count read-only function.
  // The first parameter is the contract name, the second the function name, and the
  // third the function arguments as an array. The final parameter is the tx-sender.
  const incrementResponse = simnet.callReadOnlyFn(
    'counter',
    'get-count',
    [Cl.standardPrincipal(deployer)],
    deployer
  );

  // Assert that the returned result is a uint with a value of 0 (u0).
  expect(incrementResponse.result).toBeUint(0);
});

test('count-up counts up for the tx-sender', () => {
  // Get the deployer account.
  const deployer = accounts.get('deployer')!;

  // Call count-up for deployer.
  const response = simnet.callPublicFn('counter', 'count-up', [], deployer);

  // Assert that the returned result is a boolean true.
  expect(response.result).toBeOk(Cl.bool(true));

  // Get the counter value.
  const getCountResponse = simnet.callReadOnlyFn(
    'counter',
    'get-count',
    [Cl.standardPrincipal(deployer)],
    deployer
  );

  // Assert that the returned result is a u1.
  expect(getCountResponse.result).toBeUint(1);
});

test('counters are specific to the tx-sender', () => {
  // Get some accounts.
  const deployer = accounts.get('deployer')!;
  const wallet1 = accounts.get('wallet_1')!;
  const wallet2 = accounts.get('wallet_2')!;

  // Wallet 1 calls count-up one time.
  simnet.callPublicFn('counter', 'count-up', [], wallet1);

  // Wallet 2 calls count-up two times.
  simnet.callPublicFn('counter', 'count-up', [], wallet2);
  simnet.callPublicFn('counter', 'count-up', [], wallet2);

  // Get and assert the counter value for deployer.
  const deployerCount = simnet.callReadOnlyFn(
    'counter',
    'get-count',
    [Cl.standardPrincipal(deployer)],
    deployer
  );
  expect(deployerCount.result).toBeUint(0);

  // Get and assert the counter value for wallet 1.
  const wallet1Count = simnet.callReadOnlyFn(
    'counter',
    'get-count',
    [Cl.standardPrincipal(wallet1)],
    wallet1
  );
  expect(wallet1Count.result).toBeUint(1);

  // Get and assert the counter value for wallet 2.
  const wallet2Count = simnet.callReadOnlyFn(
    'counter',
    'get-count',
    [Cl.standardPrincipal(wallet2)],
    wallet2
  );
  expect(wallet2Count.result).toBeUint(2);
});
