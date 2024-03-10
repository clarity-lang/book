import { Cl } from '@stacks/transactions';
import { test, describe, expect } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;
const wallet4 = accounts.get("wallet_4")!;
const stxVaultAmount = 5000;
const votesRequired = 1;

const memberList = Cl.list([Cl.principal(deployer), Cl.principal(wallet1)])

const members = Cl.list([
	Cl.principal(deployer),
	Cl.principal(wallet1),
	Cl.principal(wallet2),
	Cl.principal(wallet3),
	Cl.principal(wallet4)
]);

describe('Testing start', () => {
	test('Allows the contract owner to initialise the vault', () => {
		const startResponse = simnet.callPublicFn(
			'multisig-vault', 'start',
			[memberList, Cl.uint(votesRequired)],
			deployer
		);

		expect(startResponse.result).toBeOk(Cl.bool(true));
	});

	test('Does not allow anyone else to initialise the vault', () => {
		const startResponse = simnet.callPublicFn(
			'multisig-vault', 'start',
			[memberList, Cl.uint(votesRequired)],
			wallet1
		);

		expect(startResponse.result).toBeErr(Cl.uint(100));
	});

	test('Cannot start the vault more than once', () => {
		const startResponse1 = simnet.callPublicFn(
			'multisig-vault', 'start',
			[memberList, Cl.uint(votesRequired)],
			deployer
		);

		const startResponse2 = simnet.callPublicFn(
			'multisig-vault', 'start',
			[memberList, Cl.uint(votesRequired)],
			deployer
		);

		expect(startResponse1.result).toBeOk(Cl.bool(true));
		expect(startResponse2.result).toBeErr(Cl.uint(101));
	});

	test('Cannot require more votes than members', () => {
		const startResponse = simnet.callPublicFn(
			'multisig-vault', 'start',
			[members, Cl.uint(members.list.length + 1)],
			deployer
		);
		expect(startResponse.result).toBeErr(Cl.uint(102));
	});
});

describe('Testing vote', () => {
	test('Allows members to vote', () => {
		simnet.callPublicFn('multisig-vault', 'start', [members, Cl.uint(members.list.length)], deployer);
		simnet.callPublicFn('multisig-vault', 'deposit', [Cl.uint(stxVaultAmount)], deployer);
		const voteResponse = simnet.callPublicFn('multisig-vault', 'vote', [Cl.principal(deployer), Cl.bool(true)], deployer);

		expect(voteResponse.result).toBeOk(Cl.bool(true));
	});

	test('Does not allow non-members to vote', () => {
		// Without deployer
		const members = Cl.list([Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(wallet3), Cl.principal(wallet4)]);

		simnet.callPublicFn('multisig-vault', 'start', [members, Cl.uint(members.list.length)], deployer);
		simnet.callPublicFn('multisig-vault', 'deposit', [Cl.uint(stxVaultAmount)], deployer);
		const voteResponse = simnet.callPublicFn('multisig-vault', 'vote', [Cl.principal(deployer), Cl.bool(true)], deployer);

		expect(voteResponse.result).toBeErr(Cl.uint(103));
	});
});

describe('Testing get-vote', () => {
	test("Can retrieve a member's vote for a principal", () => {
		simnet.callPublicFn('multisig-vault', 'start', [members, Cl.uint(members.list.length)], deployer);
		simnet.callPublicFn('multisig-vault', 'deposit', [Cl.uint(stxVaultAmount)], deployer);
		simnet.callPublicFn('multisig-vault', 'vote', [Cl.principal(deployer), Cl.bool(true)], wallet1);
		const voteResponse = simnet.callReadOnlyFn('multisig-vault', 'get-vote', [Cl.principal(wallet1), Cl.principal(deployer)], deployer);

		expect(voteResponse.result).toBeBool(true);
	});
});

describe('Testing withdraw', () => {
	test('Principal that meets the vote threshold can withdraw the vault balance', () => {
		simnet.callPublicFn('multisig-vault', 'start', [members, Cl.uint(votesRequired)], deployer);
		simnet.callPublicFn('multisig-vault', 'deposit', [Cl.uint(stxVaultAmount)], deployer);

		simnet.callPublicFn('multisig-vault', 'vote', [Cl.principal(wallet1), Cl.bool(true)], deployer);
		simnet.callPublicFn('multisig-vault', 'vote', [Cl.principal(wallet1), Cl.bool(true)], wallet2);
		const withdrawResponse = simnet.callPublicFn('multisig-vault', 'withdraw', [], wallet1);

		expect(withdrawResponse.result).toBeOk(Cl.uint(2));
	});

	test('Principals that do not meet the vote threshold cannot withdraw the vault balance', () => {
		simnet.callPublicFn('multisig-vault', 'start', [members, Cl.uint(2)], deployer);
		simnet.callPublicFn('multisig-vault', 'deposit', [Cl.uint(stxVaultAmount)], deployer);

		simnet.callPublicFn('multisig-vault', 'vote', [Cl.principal(wallet1), Cl.bool(true)], deployer);
		const withdrawResponse = simnet.callPublicFn('multisig-vault', 'withdraw', [], wallet1);

		expect(withdrawResponse.result).toBeErr(Cl.uint(104));
	});
});

describe('Testing changing votes', () => {
	test('Members can change votes at-will, thus making an eligible recipient uneligible again', () => {
		simnet.callPublicFn('multisig-vault', 'start', [members, Cl.uint(2)], deployer);
		simnet.callPublicFn('multisig-vault', 'deposit', [Cl.uint(stxVaultAmount)], deployer);

		simnet.callReadOnlyFn('multisig-vault', 'tally-votes', [], wallet1);
		const voteResponse = simnet.callPublicFn('multisig-vault', 'vote', [Cl.principal(wallet1), Cl.bool(false)], deployer);
		const withdrawResponse = simnet.callPublicFn('multisig-vault', 'withdraw', [], wallet1);

		expect(voteResponse.result).toBeOk(Cl.bool(true));
		expect(withdrawResponse.result).toBeErr(Cl.uint(104));
	});
});
