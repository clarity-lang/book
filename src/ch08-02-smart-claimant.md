## Smart claimant

The time-locked wallet we created in the previous section is delightfully
simple. But imagine that after it is deployed, the beneficiary desires to split
the balance over multiple distinct beneficiaries. Maybe it was deployed by an
old relative years ago and the beneficiary now wants to share with the rest of
the family. Whatever the reason, we obviously cannot simply go back and change
or redeploy the time-locked wallet. At some point it is going to unlock, after
which the sole beneficiary can claim the entire balance. The solution? We can
create a minimal _ad hoc_ smart contract to act as the beneficiary! It will call
`claim`, and if successful, disburse the tokens to a list of principals equally.

The point of this exercise is to show how smart contracts can interact with each
other and how one can augment functionality or mitigate issues of older
contracts.

### Example ad hoc contract

We will add the `smart-claimant` contract to the existing time-locked wallet
project for ease of development and testing. Navigate into it and add it using
`clarinet contract new smart-claimant`.

For this example, we will assume there to be four beneficiaries. We will take
wallets 1 through 4 as defined in the Clarinet configuration. (Adjust the
addresses if your Clarinet configuration differs.)

```bash
+------------------------------------------------------+---------+
| ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK (wallet_1) | 1000000 |
+------------------------------------------------------+---------+
| ST20ATRN26N9P05V2F1RHFRV24X8C8M3W54E427B2 (wallet_2) | 1000000 |
+------------------------------------------------------+---------+
| ST21HMSJATHZ888PD0S0SSTWP4J61TCRJYEVQ0STB (wallet_3) | 1000000 |
+------------------------------------------------------+---------+
| ST2QXSK64YQX3CQPC530K79XWQ98XFAM9W3XKEH3N (wallet_4) | 1000000 |
+------------------------------------------------------+---------+
```

### Custom claim function

Clarity is well-suited for creating small ad hoc smart contracts. Instead of
coming up with a complicated mechanism for adding and removing beneficiaries, we
will keep it simple and imagine that the people that are supposed to receive a
portion of the balance are in the same room and that the wallet is unlocking
imminently. They witness the creation of the contract by the current beneficiary
and provide their wallet addresses directly.

The custom claim function will:

- Call `claim` on the time-locked wallet, exiting if it fails.
- Read the balance of the current contract. We do not read the balance of the
  time-locked wallet because someone might have sent some tokens to the
  smart-claimant by mistake. We want to include those tokens as well.
- Calculate an equal share for each recipient by dividing the total balance by
  the number of recipients.
- Send the calculated share to each recipient.
- Transfer the remainder in case of a rounding error. (Remember that
  [integers](ch02-01-primitive-types.md#unsigned-integers) have no decimal
  point.)

Whipping this up as a single hard-coded function is effortless.

```Clarity,{"nonplayable":true}
(define-public (claim)
	(begin
		(try! (as-contract (contract-call? .timelocked-wallet claim)))
		(let
			(
				(total-balance (as-contract (stx-get-balance tx-sender)))
				(share (/ total-balance u4))
			)
			(try! (as-contract (stx-transfer? share tx-sender 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK)))
			(try! (as-contract (stx-transfer? share tx-sender 'ST20ATRN26N9P05V2F1RHFRV24X8C8M3W54E427B2)))
			(try! (as-contract (stx-transfer? share tx-sender 'ST21HMSJATHZ888PD0S0SSTWP4J61TCRJYEVQ0STB)))
			(try! (as-contract (stx-transfer? (stx-get-balance tx-sender) tx-sender 'ST2QXSK64YQX3CQPC530K79XWQ98XFAM9W3XKEH3N)))
			(ok true)
		)
	)
)
```

That is it. Guarding `claim` is unnecessary because the recipients are
hardcoded. If any of the token transfers fail then the whole call is reverted.
(Curious how to reduce the code repetition seen above? You can find some tips
and tricks in the chapter on [best practices](ch14-00-best-practices.md).)

### Unit tests

The smart-claimant does not care for what reason the time-locked wallet would
error out. We therefore only need to consider the state of a successful
transfer.

```typescript
import { Cl } from '@stacks/transactions';
import { expect, test } from "vitest";

const accounts = simnet.getAccounts();

test('Disburses tokens once it can claim the time-locked wallet balance', () => {
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
```

The full source code of the project can be found here:
https://github.com/clarity-lang/book/tree/main/projects/timelocked-wallet.
