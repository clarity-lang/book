import { initSimnet } from "@hirosystems/clarinet-sdk";
import { Cl } from '@stacks/transactions';
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe('test `count-up_deployer` public function', () => {
  it('count-up counts up for the tx-sender', () => {
    const incrementResponse = simnet.callPublicFn('counter', 'count-up', [], deployer);
    expect(incrementResponse.result).toBeOk(Cl.bool(true));

    const count1 = simnet.getMapEntry('counter', 'counters', Cl.standardPrincipal(deployer));
    expect(count1).toBeSome(Cl.uint(1));
    
    const getCountResponse = simnet.callReadOnlyFn('counter', 'get-count', [Cl.standardPrincipal(deployer)], deployer);
    expect(getCountResponse.result).toBeUint(1);
  });
});


describe('test `count-up_first_time` public function', () => {
  it('get-count returns u0 for principals that never called count-up before', () => {
    const incrementResponse = simnet.callReadOnlyFn('counter', 'get-count', [Cl.standardPrincipal(deployer)], deployer);
    expect(incrementResponse.result).toBeUint(0);
  });
});

describe('test `get-count_sender` public function', () => {
  it('counters are specific to the tx-sender', () => {    
    simnet.callPublicFn('counter', 'count-up', [], wallet1);
    simnet.callPublicFn('counter', 'count-up', [], wallet2);
    simnet.callPublicFn('counter', 'count-up', [], wallet2);
    
    const getCountResponse = simnet.callReadOnlyFn('counter', 'get-count', [Cl.standardPrincipal(deployer)], deployer);
    expect(getCountResponse.result).toBeUint(0);

    const getCountResponse1 = simnet.callReadOnlyFn('counter', 'get-count', [Cl.standardPrincipal(wallet1)], wallet1);
    expect(getCountResponse1.result).toBeUint(1);

    const getCountResponse2 = simnet.callReadOnlyFn('counter', 'get-count', [Cl.standardPrincipal(wallet2)], wallet2);
    expect(getCountResponse2.result).toBeUint(2);
  });
});