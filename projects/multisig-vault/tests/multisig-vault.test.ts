import { Cl } from '@stacks/transactions';
import { describe, expect, it } from "vitest";


const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;
const wallet4 = accounts.get("wallet_4")!;
const stxVaultAmount = 5000;
const votesRequired = 1;
const memberList = Cl.list([Cl.principal(deployer), Cl.principal(wallet1)])

describe("allow_init_vault", () => {
  it('Allows the contract owner to lock an amount', () => {
    const startResponse = simnet.callPublicFn('multisig-vault', 'start', [memberList, Cl.uint(votesRequired)], deployer);
    expect(startResponse.result).toBeOk(Cl.bool(true));
  });
});

describe("deny_init_vault", () => {
  it('Does not allow anyone else to initialise the vault', () => {
    const startResponse = simnet.callPublicFn('multisig-vault', 'start', [memberList, Cl.uint(votesRequired)], wallet1);
    expect(startResponse.result).toBeErr(Cl.uint(100));
  });
});

describe("deny_vault_multilock", () => {
  it('Cannot start the vault more than once', () => {
    const startResponse1 = simnet.callPublicFn('multisig-vault', 'start', [memberList, Cl.uint(votesRequired)], deployer);
    const startResponse2 = simnet.callPublicFn('multisig-vault', 'start', [memberList, Cl.uint(votesRequired)], deployer);

    expect(startResponse1.result).toBeOk(Cl.bool(true));
    expect(startResponse2.result).toBeErr(Cl.uint(101));
  });
});

describe("deny_more_voter", () => {
  it('Cannot require more votes than members', () => {
    const members = Cl.list([Cl.principal(deployer), Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3), Cl.principal(wallet4)]);
    const startResponse = simnet.callPublicFn('multisig-vault', 'start', [members, Cl.uint(members.list.length+1)], deployer);
    simnet.callPublicFn('multisig-vault','deposit', [Cl.uint(stxVaultAmount)], deployer);


    expect(startResponse.result).toBeErr(Cl.uint(102));
    
  });
});

describe("allow_vote_member", () => {
  it('Allows members to vote', () => {
    const members = Cl.list([Cl.principal(deployer), Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3), Cl.principal(wallet4)]);
    simnet.callPublicFn('multisig-vault', 'start', [members, Cl.uint(members.list.length)], deployer);
    simnet.callPublicFn('multisig-vault','deposit', [Cl.uint(stxVaultAmount)], deployer);
    const voteResponse = simnet.callPublicFn('multisig-vault','vote', [Cl.principal(deployer), Cl.bool(true)], deployer);

    expect(voteResponse.result).toBeOk(Cl.bool(true));
    
  });
});

describe("deny_vote_nonmember", () => {
  it('Allows members to vote', () => {
    const members = Cl.list([Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3), Cl.principal(wallet4)]);
    simnet.callPublicFn('multisig-vault', 'start', [members, Cl.uint(members.list.length)], deployer);
    simnet.callPublicFn('multisig-vault','deposit', [Cl.uint(stxVaultAmount)], deployer);
    const voteResponse = simnet.callPublicFn('multisig-vault','vote', [Cl.principal(deployer), Cl.bool(true)], deployer);

    expect(voteResponse.result).toBeErr(Cl.uint(103));
    
  });
});


describe("allow_retrieve_vote", () => {
  it('Can retrieve a members vote for a principal', () => {
    const members = Cl.list([Cl.principal(deployer), Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3), Cl.principal(wallet4)]);
    simnet.callPublicFn('multisig-vault', 'start', [members, Cl.uint(members.list.length)], deployer);
    simnet.callPublicFn('multisig-vault','deposit', [Cl.uint(stxVaultAmount)], deployer);
    simnet.callPublicFn('multisig-vault','vote', [Cl.principal(deployer), Cl.bool(true)], wallet1);
    const voteResponse = simnet.callReadOnlyFn('multisig-vault','get-vote', [Cl.principal(wallet1), Cl.principal(deployer)], deployer);

    expect(voteResponse.result).toBeBool(true);
    
  });
});


describe("allow_withdrawal", () => {
  it('Principal that meets the vote threshold can withdraw the vault balance', () => {
    const members = Cl.list([Cl.principal(deployer), Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3), Cl.principal(wallet4)]);
    simnet.callPublicFn('multisig-vault', 'start', [members, Cl.uint(votesRequired)], deployer);
    simnet.callPublicFn('multisig-vault','deposit', [Cl.uint(stxVaultAmount)], deployer);

    simnet.callPublicFn('multisig-vault','vote', [Cl.principal(wallet1), Cl.bool(true)], deployer);
    simnet.callPublicFn('multisig-vault','vote', [Cl.principal(wallet1), Cl.bool(true)], wallet2);
    const withdrawResponse = simnet.callPublicFn('multisig-vault','withdraw', [], wallet1);

    expect(withdrawResponse.result).toBeOk(Cl.uint(2));
    
  });
});

describe("deny_withdrawal", () => {
  it('Principals that do not meet the vote threshold cannot withdraw the vault balance', () => {
    const members = Cl.list([Cl.principal(deployer), Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3), Cl.principal(wallet4)]);
    simnet.callPublicFn('multisig-vault', 'start', [members, Cl.uint(2)], deployer);
    simnet.callPublicFn('multisig-vault','deposit', [Cl.uint(stxVaultAmount)], deployer);

    simnet.callPublicFn('multisig-vault','vote', [Cl.principal(wallet1), Cl.bool(true)], deployer);
    const withdrawResponse = simnet.callPublicFn('multisig-vault','withdraw', [], wallet1);

    expect(withdrawResponse.result).toBeErr(Cl.uint(104));
    
  });
});

describe("allow_change_Vote", () => {
  it('Members can change votes at-will, thus making an eligible recipient uneligible again', () => {
    const members = Cl.list([Cl.principal(deployer), Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3), Cl.principal(wallet4)]);
    simnet.callPublicFn('multisig-vault', 'start', [members, Cl.uint(2)], deployer);
    simnet.callPublicFn('multisig-vault','deposit', [Cl.uint(stxVaultAmount)], deployer);

    simnet.callReadOnlyFn('multisig-vault','tally-votes', [], wallet1);
    const voteResponse = simnet.callPublicFn('multisig-vault','vote', [Cl.principal(wallet1), Cl.bool(false)], deployer);
    const withdrawResponse = simnet.callPublicFn('multisig-vault','withdraw', [], wallet1);

    expect(voteResponse.result).toBeOk(Cl.bool(true));
    expect(withdrawResponse.result).toBeErr(Cl.uint(104));
    
  });
});



// type InitContractOptions = {
// 	members?: Array<string>,
// 	votesRequired?: number,
// 	stxVaultAmount?: number
// };


// function initContract({members = defaultMembers, votesRequired = defaultVotesRequired, stxVaultAmount = defaultStxVaultAmount }: InitContractOptions) {
// 	const contractPrincipal = Array.from(simnet.getContractsInterfaces().keys())[1];
// 	const memberAccounts = members.map(name => accounts.get(name)!);
// 	const nonMemberAccounts = Array.from(accounts.keys()).filter(key => !members.includes(key)).map(name => accounts.get(name)!);
	
// 	simnet.callPublicFn('multisig-vault', 'start', [Cl.list(memberAccounts.map(account => Cl.principal(account))), Cl.uint(votesRequired)], deployer);
// 	result = simnet.callPublicFn('multisig-vault', 'deposit', [Cl.uint(stxVaultAmount)], deployer);
	
// 	return {contractPrincipal, memberAccounts, nonMemberAccounts};
// }