import { Cl } from '@stacks/transactions';
import { expect, it } from "vitest";

const accounts = simnet.getAccounts();

it('Disburses tokens once it can claim the time-locked wallet balance', () => {
	const deployer = accounts.get("deployer")!;
	const beneficiary = `${deployer}.smart-claimant`;

	// Wallets to receive the share. Hardcoded in contract.
	const wallet1 = 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK';
	const wallet2 = 'ST20ATRN26N9P05V2F1RHFRV24X8C8M3W54E427B2';
	const wallet3 = 'ST21HMSJATHZ888PD0S0SSTWP4J61TCRJYEVQ0STB';
	const wallet4 = 'ST2QXSK64YQX3CQPC530K79XWQ98XFAM9W3XKEH3N';

	const unlockHeight = 10;
	const amount = 1000; // be sure to pick a test amount that is divisible by 4 for this test.
	const share = Math.floor(amount / 4);

	simnet.callPublicFn(
		'timelocked-wallet', 'lock',
		[Cl.principal(beneficiary), Cl.uint(unlockHeight), Cl.uint(amount)],
		deployer
	);
	simnet.mineEmptyBlocks(unlockHeight);

	const claimResponse = simnet.callPublicFn('smart-claimant', 'claim', [], deployer);

	// The claim should be successful.
	expect(claimResponse.result).toBeOk(Cl.bool(true));

	// The claim should have 5 events, all of type 'stx_transfer_event'.
	// 1 for the smart-claimant, and 4 for the wallets.
	expect(claimResponse.events).toHaveLength(5);
	expect(claimResponse.events.every(event => event.event === 'stx_transfer_event')).true;

	const eventsData = claimResponse.events.map(x => x.data);

	// The smart-claimant should have received the amount.
	expect(eventsData).toContainEqual({
		amount: amount.toString(),
		memo: '',
		sender: `${deployer}.timelocked-wallet`,
		recipient: `${deployer}.smart-claimant`,
	});

	// All wallets should have received their share.
	[wallet1, wallet2, wallet3, wallet4].forEach(wallet => {
		expect(eventsData).toContainEqual({
			amount: share.toString(),
			memo: '',
			sender: `${deployer}.smart-claimant`,
			recipient: wallet,
		});
	});
});
