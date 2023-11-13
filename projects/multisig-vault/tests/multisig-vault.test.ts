import { tx } from "@hirosystems/clarinet-sdk";
import { test, expect } from "vitest";
import { Cl } from '@stacks/transactions';


const accounts = simnet.getAccounts();
const deployer = accounts.get('deployer')!;
const memberB = accounts.get('wallet_1')!;
const memberList = Cl.list([Cl.standardPrincipal(deployer), Cl.standardPrincipal(memberB)]);
const contractName = 'multisig-vault';
const contractPrinicipal = deployer + "." + contractName;
const votesRequired = 1;
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
	const allAccounts = simnet.getAccounts();
	const contractPrincipal = Cl.contractPrincipal(deployer, contractName);
	const memberAccounts = defaultMembers.map(name => allAccounts.get(name)!);
	const nonMemberAccounts = Array.from(allAccounts.keys()).filter(key => !members.includes(key)).map(name => allAccounts.get(name)!);
	const startBlock = simnet.mineBlock([
		tx.callPublicFn(contractName, 'start', [Cl.list(memberAccounts.map(account => Cl.standardPrincipal(account))), Cl.uint(votesRequired)], deployer),
		tx.callPublicFn(contractName, 'deposit', [Cl.uint(stxVaultAmount)], deployer),
	]);
	return { deployer, contractPrincipal, memberAccounts, nonMemberAccounts, startBlock };
};

test("Allows the contract owner to indescribe,itialise the vault",
	async (chain: Chain) => {
		const block = simnet.mineBlock([
			tx.callPublicFn(contractName, 'start', [memberList, Cl.uint(votesRequired)], deployer)
		]);
		expect(block[0].result).toBeOk(Cl.bool(true));
	}
);

test("Does not allow anyone else to initialise the vault",
	async (chain: Chain) => {
		const block = simnet.mineBlock([
			tx.callPublicFn(contractName, 'start', [memberList, Cl.uint(votesRequired)], memberB)
		]);
		expect(block[0].result).toBeErr(Cl.uint(100));
	}
);

test("Cannot start the vault more than once",
	async (chain: Chain, accounts: Map<string, Account>) => {
		const block = simnet.mineBlock([
			tx.callPublicFn(contractName, 'start', [memberList, Cl.uint(votesRequired)], deployer),
			tx.callPublicFn(contractName, 'start', [memberList, Cl.uint(votesRequired)], deployer)
		]);
		expect(block[0].result).toBeOk(Cl.bool(true));
		expect(block[1].result).toBeErr(Cl.uint(101));
	}
);

test("Cannot require more votes than members",
	async (chain: Chain, accounts: Map<string, Account>) => {
		const { startBlock } = initContract({ chain, accounts, votesRequired: defaultMembers.length + 1 });
		expect(startBlock[0].result).toBeErr(Cl.uint(102));
	}
);

test("Allows members to vote",
	async (chain: Chain, accounts: Map<string, Account>) => {
		const { memberAccounts, deployer } = initContract({ chain, accounts });
		const votes = memberAccounts.map(account => tx.callPublicFn(contractName, 'vote', [Cl.standardPrincipal(deployer), Cl.bool(true)], account));
		const block = simnet.mineBlock(votes);
		block.map(block => expect(block.result).toBeOk(Cl.bool(true)));
	}
);

test("Does not allow non-members to vote",
	async (chain: Chain, accounts: Map<string, Account>) => {
		const { nonMemberAccounts, deployer } = initContract({ chain, accounts });
		const votes = nonMemberAccounts.map(account => tx.callPublicFn(contractName, 'vote', [Cl.standardPrincipal(deployer), Cl.bool(true)], account));
		const block = simnet.mineBlock(votes);
		block.map(block => expect(block.result).toBeErr(Cl.uint(103)));
	}
);
 
test("Can retrieve a member's vote for a principal",
	async (chain: Chain, accounts: Map<string, Account>) => {
		const { memberAccounts, deployer } = initContract({ chain, accounts });
		const allAccounts = simnet.getAccounts();
		const memberA = allAccounts.get('wallet_2')!;
		const vote = Cl.bool(true);
		simnet.mineBlock([
			tx.callPublicFn(contractName, 'vote', [Cl.standardPrincipal(deployer), vote], memberA)
		]);
		const receipt = simnet.callReadOnlyFn(contractName, 'get-vote', [Cl.standardPrincipal(memberA), Cl.standardPrincipal(deployer)], memberA);
		expect(receipt.result).toStrictEqual(Cl.bool(true));
	}
);

test("Principal that meets the vote threshold can withdraw the vault balance",
	async (chain: Chain, accounts: Map<string, Account>) => {
		const { contractPrincipal, memberAccounts } = initContract({ chain, accounts });
		const recipient = memberAccounts.shift()!;
		const votes = memberAccounts.map(account => tx.callPublicFn(contractName, 'vote', [Cl.standardPrincipal(recipient), Cl.bool(true)], account));
		simnet.mineBlock(votes);
		const block = simnet.mineBlock([
			tx.callPublicFn(contractName, 'withdraw', [], recipient)
		]);
		expect(block[0].result).toBeOk(Cl.uint(votes.length));
		
		expect(block[0].events[0].data).toStrictEqual(
			JSON.parse('{"amount": "' + defaultStxVaultAmount + 
						'", "memo":"", "recipient":"' + recipient + 
						'", "sender":"' + contractPrinicipal +'"}')
		)
	}
);

test("Principals that do not meet the vote threshold cannot withdraw the vault balance",
	async (chain: Chain, accounts: Map<string, Account>) => {
		const { memberAccounts, nonMemberAccounts } = initContract({ chain, accounts });
		const recipient = memberAccounts.shift()!;
		const [nonMemberA] = nonMemberAccounts;
		const votes = memberAccounts.slice(0, defaultVotesRequired - 1).map(account => tx.callPublicFn(contractName, 'vote', [Cl.standardPrincipal(recipient), Cl.bool(true)], account));
		simnet.mineBlock(votes);
		const block = simnet.mineBlock([
			tx.callPublicFn(contractName, 'withdraw', [], recipient),
			tx.callPublicFn(contractName, 'withdraw', [], nonMemberA)
		]);
		block.map(block => expect(block.result).toBeErr(Cl.uint(104)));
	}
);

test("Members can change votes at-will, thus making an eligible recipient uneligible again",
	async (chain: Chain, accounts: Map<string, Account>) => {
		const { memberAccounts } = initContract({ chain, accounts });
		const recipient = memberAccounts.shift()!;
		const votes = memberAccounts.map(account => tx.callPublicFn(contractName, 'vote', [Cl.standardPrincipal(recipient), Cl.bool(true)], account));
		simnet.mineBlock(votes);
		const receipt = simnet.callReadOnlyFn(contractName, 'tally-votes', [], recipient);
		expect(receipt.result).toStrictEqual(Cl.uint(votes.length));
		const block = simnet.mineBlock([
			tx.callPublicFn(contractName, 'vote', [Cl.standardPrincipal(recipient), Cl.bool(false)], memberAccounts[0]),
			tx.callPublicFn(contractName, 'withdraw', [], recipient),
		]);
		expect(block[0].result).toBeOk(Cl.bool(true));
		expect(block[1].result).toBeErr(Cl.uint(104));
	}
);