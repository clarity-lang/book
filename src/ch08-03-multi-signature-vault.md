## Multi-signature vault

Blockchain technology has enabled us to decentralise more than just digital
asset management. Another popular field of study is that of decentralised
governance. Participating in a vote of any kind can be a very opaque process.
Whether it is a vote for the most popular song on the radio or for an elected
government official, participants cannot verify whether the process is fair or
that the results are genuine. DAOs (_Decentralised Autonomous Organisations_)
can change all that. A DAO is a smart contract that organises some type of
decision-making power, usually on behalf of its members.

DAOs can be very complex, featuring multiple levels of management, asset
delegation, and member management. Some even have their own tokens that function
as an ownership stake or right to access! Most, if not all, aspects of a
conventional corporate structure can be translated into a set of smart contracts
that mandate corporate bylaws with the integrity that a blockchain provides. The
potential of DAOs cannot be underestimated.

For this project, we will create a simplified DAO that allows its members to
vote on which principal is allowed to withdraw the DAO's token balance. The DAO
will be initialised once when deployed, after which members can vote in favour
or against specific principals.

### Features

The contract deployer will only have the ability to initialise the contract and
will then run its course. The initialising call will define the members (a list
of principals) and the number of votes required to be allowed to withdraw the
balance.

The voting mechanism will work as follows:

- Members can issue a yes/no vote for any principal.
- Voting for the same principal again replaces the old vote.
- Anyone can check the status of a vote.
- Anyone can tally all the votes for a specific principal.

Once a principal reaches the number of votes required, it may withdraw the
tokens.

### Constants & variables

We begin with the usual constants to define the contract owner and error codes.
When it comes to errors, we can foresee three failures on the initialising step.

1. Someone other than the owner is trying to initialise.
2. The vault is already locked.
3. The initialising call specifies an amount of votes required that is larger
   the number of members.

The voting process itself will only fail if a non-member tries to vote. Finally,
the withdrawal function will only succeed if the voting threshold has been
reached.

```Clarity,{"nonplayable":true}
;; Owner
(define-constant contract-owner tx-sender)

;; Errors
(define-constant err-owner-only (err u100))
(define-constant err-already-locked (err u101))
(define-constant err-more-votes-than-members-required (err u102))
(define-constant err-not-a-member (err u103))
(define-constant err-votes-required-not-met (err u104))
```

The members will be stored in a list with a given maximum length. The votes
themselves will be stored in a map that uses a tuple key with two values: the
principal of the member issuing the vote and the principal being voted for.

```Clarity,{"nonplayable":true}
;; Variables
(define-data-var members (list 100 principal) (list))
(define-data-var votes-required uint u1)
(define-map votes {member: principal, recipient: principal} {decision: bool})
```

For a simple voting contract, storing the members in a list is acceptable. It
also allows us to practice iterating over a list in a few interesting ways.
However, it is important to note that such member lists are not sufficient
for larger projects as they can quickly become expensive to use. The chapter on
best practices covers some uses and possible misuses of lists.

### Implementing start

The `start` function will be called by the contract owner to initialise the
vault. It is a simple function that updates the two variables with the proper
guards in place.

```Clarity,{"nonplayable":true}
(define-public (start (new-members (list 100 principal)) (new-votes-required uint))
	(begin
		(asserts! (is-eq contract-caller contract-owner) err-owner-only)
		(asserts! (is-eq (len (var-get members)) u0) err-already-locked)
		(asserts! (>= (len new-members) new-votes-required) err-more-votes-than-members-required)
		(var-set members new-members)
		(var-set votes-required new-votes-required)
		(ok true)
	)
)
```

### Implementing vote

The vote function is even more straightforward. All we have to do is make sure
the `contract-caller` is one of the members. We can do that by checking if the
`contract-caller` is present in the members list by using the built-in `index-of`
function. It returns an [optional](ch02-03-composite-types.md#optionals) type,
so we can simply check if it returns a `(some ...)`, rather than a `none`.

```Clarity,{"nonplayable":true}
(define-public (vote (recipient principal) (decision bool))
	(begin
		(asserts! (is-some (index-of (var-get members) contract-caller)) err-not-a-member)
		(ok (map-set votes {member: tx-sender, recipient: recipient} {decision: decision}))
	)
)
```

While we are at it, let us also add a read-only function to retrieve a vote. If
a member never voted for a specific principal before, we will default to a
negative vote of `false`.

```Clarity,{"nonplayable":true}
(define-read-only (get-vote (member principal) (recipient principal))
	(default-to false (get decision (map-get? votes {member: member, recipient: recipient})))
)
```

There is a lot going on in this function. Here is what happens step by step:

- Use `map-get?` to retrieve the vote tuple. The function will return a `some`
  or a `none`.
- `get` returns the value of the specified key in a tuple. If `get` is supplied
  with a `(some tuple)`, it will return a `(some value)`. If `get` is supplied
  `none`, it returns `none`.
- `default-to` attempts to unwrap the result of `get`. If it is a `some`, it
  returns the wrapped value. If it is `none`, it returns the default value, in
  this case `false`.

### Tallying the votes

The challenge now is to create a function that can calculate the number of
positive votes for a principal. We will have to iterate over the members,
retrieve their votes, and increment a counter if the vote equals `true`. Since
Clarity is non-Turing complete, unbounded _for-loops_ are impossible. In the
[chapter on sequences](ch02-02-sequence-types.md#lists) we learned that the only
two ways to iterate over a list are by using the `map` or `fold` function.

The choice of whether to use `map` or `fold` comes down to a simple question:
should the result be another list or a singular value?

We want to _reduce_ the list of members to a _number_ that represents the total
amount of positive votes; meaning, we need `fold`. First we look at the function
signature again.

```Clarity,{"nonplayable":true}
(fold accumulator-function input-list initial-value)
```

`fold` will iterate over `input-list`, calling `accumulator-function` for every
element in the list. The accumulator function receives two parameters: the next
member in the list and the previous accumulator value. The value returned by the
accumulator function is used as the input for the next accumulator call.

Since we want to count the number of positive votes, we should increment the
accumulator value only when the vote for the principal is `true`. There is no
built-in function that can do that so we have to create a custom accumulator as
a private function.

```Clarity,{"nonplayable":true}
(define-private (tally (member principal) (accumulator uint))
	(if (get-vote member tx-sender) (+ accumulator u1) accumulator)
)

(define-read-only (tally-votes)
	(fold tally (var-get members) u0)
)
```

The `tally-votes` function returns the result of folding over the members list.
Our custom accumulator function `tally` calls the `get-vote` read-only function
we created earlier with the current current member from the list and the
`tx-sender`. The result of this call will be either `true` or `false`. If the
result is `true`, then `tally` returns the accumulator incremented by one.
Otherwise, it returns just the current accumulator value.

Unpacking the `if` expression:

```Clarity,{"nonplayable":true}
(if
	(get-vote member tx-sender) ;; The condition (boolean expression).
	(+ accumulator u1)          ;; Value to return if the condition is true.
	accumulator                 ;; Value to return if the condition is false.
)
```

Since `tally-votes` is a read-only function, it can be called with any
`tx-sender` principal without having to send a transaction. Very convenient.

### Implementing withdraw

We have everything we need to create the withdraw function. It will tally the
votes for `tx-sender` and check if it is larger than or equal to the number of
votes required. If the transaction sender passes the bar, the contract shall
transfer all its holdings to the `tx-sender`.

```Clarity,{"nonplayable":true}
(define-public (withdraw)
	(let
		(
			(recipient tx-sender)
			(total-votes (tally-votes))
		)
		(asserts! (>= total-votes (var-get votes-required)) err-votes-required-not-met)
		(try! (as-contract (stx-transfer? (stx-get-balance tx-sender) tx-sender recipient)))
		(ok total-votes)
	)
)
```

The total votes are returned for convenience so that it can be recorded on the
blockchain and perhaps used by the calling application.

### Deposit convenience function

Finally, we will add a convenience function to deposit tokens into the contract.
It is definitely not required as users can transfer tokens to a contract
principal directly. The function will be useful when writing unit tests later.

```Clarity,{"nonplayable":true}
(define-public (deposit (amount uint))
	(stx-transfer? amount tx-sender (as-contract tx-sender))
)
```
---
## Unit tests

### Testing start

Let us get the tests for `start` out of the way first:

- The contract owner can initialise the vault.
- Nobody else can initialise the vault.
- The vault can only be initialised once.

```typescript
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
```

### Testing vote

Only members should be allowed to successfully call `vote`. It should also
return the right error response if a non-member calls the function.

```typescript
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
```

### Testing get-vote

`get-vote` is a simple read-only function that returns the boolean vote status
for a member-recipient combination.

```typescript
describe('Testing get-vote', () => {
	test("Can retrieve a member's vote for a principal", () => {
		simnet.callPublicFn('multisig-vault', 'start', [members, Cl.uint(members.list.length)], deployer);
		simnet.callPublicFn('multisig-vault', 'deposit', [Cl.uint(stxVaultAmount)], deployer);
		simnet.callPublicFn('multisig-vault', 'vote', [Cl.principal(deployer), Cl.bool(true)], wallet1);
		const voteResponse = simnet.callReadOnlyFn('multisig-vault', 'get-vote', [Cl.principal(wallet1), Cl.principal(deployer)], deployer);

		expect(voteResponse.result).toBeBool(true);
	});
});
```

### Testing withdraw

The `withdraw` function returns an `ok` response containing the total number of
votes for the `tx-sender` if the threshold is met. Otherwise it returns an
`(err u104)` (`err-votes-required-not-met`).

```typescript
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
```

### Testing changing votes

Members have the ability to change their votes at any time. We will therefore
add a final test where a vote change causes a recipient to no longer be eligible
to claim the balance.

```typescript
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
```

The full source code of the project can be found here:
https://github.com/clarity-lang/book/tree/main/projects/multisig-vault.
