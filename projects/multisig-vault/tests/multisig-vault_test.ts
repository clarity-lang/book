import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.15.2/index.ts';

const contractName = 'multisig-vault';

const defaultStxVaultAmount = 5000;
const defaultMembers = ['deployer', 'wallet_1', 'wallet_2', 'wallet_3', 'wallet_4'];
const defaultVotesRequired = defaultMembers.length - 1;

type InitContractOptions = {
	chain: Chain,
	accounts: Map<string, Account>,
	members?: Array<string>,
	votesRequired?: number,
	stxVaultAmount?: number
};

function initContract({ chain, accounts, members = defaultMembers, votesRequired = defaultVotesRequired, stxVaultAmount = defaultStxVaultAmount }: InitContractOptions) {
	const deployer = accounts.get('deployer')!;
	const contractPrincipal = `${deployer.address}.${contractName}`;
	const memberAccounts = members.map(name => accounts.get(name)!);
	const nonMemberAccounts = Array.from(accounts.keys()).filter(key => !members.includes(key)).map(name => accounts.get(name)!);
	const startBlock = chain.mineBlock([
		Tx.contractCall(contractName, 'start', [types.list(memberAccounts.map(account => types.principal(account.address))), types.uint(votesRequired)], deployer.address),
		Tx.contractCall(contractName, 'deposit', [types.uint(stxVaultAmount)], deployer.address),
	]);
	return { deployer, contractPrincipal, memberAccounts, nonMemberAccounts, startBlock };
}

Clarinet.test({
	name: "Allows the contract owner to initialise the vault",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const memberB = accounts.get('wallet_1')!;
		const votesRequired = 1;
		const memberList = types.list([types.principal(deployer.address), types.principal(memberB.address)]);
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'start', [memberList, types.uint(votesRequired)], deployer.address)
		]);
		block.receipts[0].result.expectOk().expectBool(true);
	}
});

Clarinet.test({
	name: "Does not allow anyone else to initialise the vault",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const memberB = accounts.get('wallet_1')!;
		const votesRequired = 1;
		const memberList = types.list([types.principal(deployer.address), types.principal(memberB.address)]);
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'start', [memberList, types.uint(votesRequired)], memberB.address)
		]);
		block.receipts[0].result.expectErr().expectUint(100);
	}
});

Clarinet.test({
	name: "Cannot start the vault more than once",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const deployer = accounts.get('deployer')!;
		const memberB = accounts.get('wallet_1')!;
		const votesRequired = 1;
		const memberList = types.list([types.principal(deployer.address), types.principal(memberB.address)]);
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'start', [memberList, types.uint(votesRequired)], deployer.address),
			Tx.contractCall(contractName, 'start', [memberList, types.uint(votesRequired)], deployer.address)
		]);
		block.receipts[0].result.expectOk().expectBool(true);
		block.receipts[1].result.expectErr().expectUint(101);
	}
});

Clarinet.test({
	name: "Cannot require more votes than members",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const { startBlock } = initContract({ chain, accounts, votesRequired: defaultMembers.length + 1 });
		startBlock.receipts[0].result.expectErr().expectUint(102);
	}
});

Clarinet.test({
	name: "Allows members to vote",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const { memberAccounts, deployer } = initContract({ chain, accounts });
		const votes = memberAccounts.map(account => Tx.contractCall(contractName, 'vote', [types.principal(deployer.address), types.bool(true)], account.address));
		const block = chain.mineBlock(votes);
		block.receipts.map(receipt => receipt.result.expectOk().expectBool(true));
	}
});

Clarinet.test({
	name: "Does not allow non-members to vote",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const { nonMemberAccounts, deployer } = initContract({ chain, accounts });
		const votes = nonMemberAccounts.map(account => Tx.contractCall(contractName, 'vote', [types.principal(deployer.address), types.bool(true)], account.address));
		const block = chain.mineBlock(votes);
		block.receipts.map(receipt => receipt.result.expectErr().expectUint(103));
	}
});

Clarinet.test({
	name: "Can retrieve a member's vote for a principal",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const { memberAccounts, deployer } = initContract({ chain, accounts });
		const [memberA] = memberAccounts;
		const vote = types.bool(true);
		chain.mineBlock([
			Tx.contractCall(contractName, 'vote', [types.principal(deployer.address), vote], memberA.address)
		]);
		const receipt = chain.callReadOnlyFn(contractName, 'get-vote', [types.principal(memberA.address), types.principal(deployer.address)], memberA.address);
		receipt.result.expectBool(true);
	}
});

Clarinet.test({
	name: "Principal that meets the vote threshold can withdraw the vault balance",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const { contractPrincipal, memberAccounts } = initContract({ chain, accounts });
		const recipient = memberAccounts.shift()!;
		const votes = memberAccounts.map(account => Tx.contractCall(contractName, 'vote', [types.principal(recipient.address), types.bool(true)], account.address));
		chain.mineBlock(votes);
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'withdraw', [], recipient.address)
		]);
		block.receipts[0].result.expectOk().expectUint(votes.length);
		block.receipts[0].events.expectSTXTransferEvent(defaultStxVaultAmount, contractPrincipal, recipient.address);
	}
});

Clarinet.test({
	name: "Principals that do not meet the vote threshold cannot withdraw the vault balance",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const { memberAccounts, nonMemberAccounts } = initContract({ chain, accounts });
		const recipient = memberAccounts.shift()!;
		const [nonMemberA] = nonMemberAccounts;
		const votes = memberAccounts.slice(0, defaultVotesRequired - 1).map(account => Tx.contractCall(contractName, 'vote', [types.principal(recipient.address), types.bool(true)], account.address));
		chain.mineBlock(votes);
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'withdraw', [], recipient.address),
			Tx.contractCall(contractName, 'withdraw', [], nonMemberA.address)
		]);
		block.receipts.map(receipt => receipt.result.expectErr().expectUint(104));
	}
});

Clarinet.test({
	name: "Members can change votes at-will, thus making an eligible recipient uneligible again",
	async fn(chain: Chain, accounts: Map<string, Account>) {
		const { memberAccounts } = initContract({ chain, accounts });
		const recipient = memberAccounts.shift()!;
		const votes = memberAccounts.map(account => Tx.contractCall(contractName, 'vote', [types.principal(recipient.address), types.bool(true)], account.address));
		chain.mineBlock(votes);
		const receipt = chain.callReadOnlyFn(contractName, 'tally-votes', [], recipient.address);
		receipt.result.expectUint(votes.length);
		const block = chain.mineBlock([
			Tx.contractCall(contractName, 'vote', [types.principal(recipient.address), types.bool(false)], memberAccounts[0].address),
			Tx.contractCall(contractName, 'withdraw', [], recipient.address),
		]);
		block.receipts[0].result.expectOk().expectBool(true);
		block.receipts[1].result.expectErr().expectUint(104);
	}
});
