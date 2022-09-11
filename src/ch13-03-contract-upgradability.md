## Contract upgradability

Once a smart contract is deployed to a blockchain it can no longer be changed.
It is yet another property that puts smart contract development at odds with
conventional application development: there is no way to _update_ contract code
in the future. One cannot simply issue a fix if a bug is later discovered. But
like any application, usually updates are necessary to move it forward. In this
chapter we will explore some ways in which developers can build decentralised
applications that are still upgradable in the future.

There is no catch-all approach to creating a maximally flexible smart contract
solution. However, keeping the following principles in mind will go a long way:

- Keep logic separate, do not make one monolithic contract.
- Make contracts stateless whenever possible.
- Do not hardcode principals unless you are absolutely certain you will not have
  to replace them.
- Do not rely on the contract deployer for future upgrades.

### Monolithic versus modular designs

There are certain benefits to fitting all business logic in a single smart
contract. However, it can be very detrimental when it comes to upgradability. To
illustrate the problem, imagine a DAO-like smart contract that allows members to
submit proposals and vote on them. All members can vote but only those that are
whitelisted can submit proposals. A vote can only be cast once and cannot be
changed.

Such a contract might look like the example given below. Logic to manage members
and whitelisted members has been left out for brevity.

```clarity,{"nonplayable":true}
(define-constant err-not-whitelisted (err u100))
(define-constant err-unknown-proposal (err u101))
(define-constant err-not-member (err u102))
(define-constant err-already-voted (err u103))
(define-constant err-voting-ended (err u104))

(define-constant proposal-duration u1440)

(define-data-var proposal-nonce uint u0)
(define-map proposals uint
	{
	proposer: principal,
	title: (string-ascii 100),
	end-height: uint,
	yes-votes: uint,
	no-votes: uint
	}
)
(define-map proposal-votes {voter: principal, proposal-id: uint} {vote-height: uint, for: bool})

(define-map members principal bool)
(define-map whitelisted-members principal bool)

(define-read-only (get-proposal (proposal-id uint))
	(ok (map-get? proposals proposal-id))
)

(define-public (submit-proposal (title (string-ascii 100)))
	(let
		(
			(proposal-id (+ (var-get proposal-nonce) u1))
		)
		(asserts! (default-to false (map-get? whitelisted-members tx-sender)) err-not-whitelisted)
		(map-set proposals proposal-id
			{
			proposer: tx-sender,
			title: title,
			end-height: (+ block-height proposal-duration),
			yes-votes: u0,
			no-votes: u0
			}
		)
		(var-set proposal-nonce proposal-id)
		(ok proposal-id)
	)
)

(define-read-only (get-vote (member principal) (proposal-id uint))
	(map-get? proposal-votes {voter: member, proposal-id: proposal-id})
)

(define-public (vote (for bool) (proposal-id uint))
	(let
		(
			(proposal (unwrap! (map-get? proposals proposal-id) err-unknown-proposal))
		)
		(asserts! (default-to false (map-get? members tx-sender)) err-not-member)
		(asserts! (< block-height (get end-height proposal)) err-voting-ended)
		(asserts! (is-none (get-vote tx-sender proposal-id)) err-already-voted)
		(map-set proposal-votes {voter: tx-sender, proposal-id: proposal-id} {vote-height: block-height, for: for})
		(if for
			(map-set proposals proposal-id (merge proposal {yes-votes: (+ (get yes-votes proposal) u1)}))
			(map-set proposals proposal-id (merge proposal {no-votes: (+ (get no-votes proposal) u1)}))
		)
		(ok true)
	)
)
```

The code is rather succinct. But which immediate problems can you spot with this
implementation? The proposal and voting logic are closely coupled. Furthermore,
the state—that is to say, the stored data—is contained within the same contract.
The developers will have an extremely hard time if they want to change the rules
that govern proposal submission. We can reimagine the project as two separate
contracts, one that stores the proposals and votes, and another contract that is
allowed to manipulate the data.

**Data storage contract**

The contract that stores the data will only allow one privileged principal to
change its internal state. The principal itself can also be updated the same
way.

```clarity,{"nonplayable":true}
(define-constant err-not-owner (err u100))
(define-constant err-unknown-proposal (err u101))
(define-constant err-voting-ended (err u102))

(define-data-var contract-owner principal tx-sender)
(define-data-var proposal-nonce uint u0)
(define-map proposals uint
	{
	proposer: principal,
	title: (string-ascii 100),
	end-height: uint,
	yes-votes: uint,
	no-votes: uint
	}
)
(define-map proposal-votes {voter: principal, proposal-id: uint} {vote-height: uint, for: bool})

(define-read-only (is-contract-owner)
	(ok (asserts! (is-eq contract-caller (var-get contract-owner)) err-not-owner))
)

(define-read-only (get-contract-owner)
	(ok (var-get contract-owner))
)

(define-public (set-contract-owner (new-owner principal))
	(begin
		(try! (is-contract-owner))
		(ok (var-set contract-owner new-owner))
	)
)

(define-read-only (get-proposal (proposal-id uint))
	(map-get? proposals proposal-id)
)

(define-public (insert-proposal (title (string-ascii 100)) (end-height uint) (proposer principal))
	(let
		(
			(proposal-id (+ (var-get proposal-nonce) u1))
		)
		(try! (is-contract-owner))
		(map-set proposals proposal-id
			{
			proposer: proposer,
			title: title,
			end-height: end-height,
			yes-votes: u0,
			no-votes: u0
			}
		)
		(var-set proposal-nonce proposal-id)
		(ok proposal-id)
	)
)

(define-read-only (get-vote (member principal) (proposal-id uint))
	(ok (map-get? proposal-votes {voter: member, proposal-id: proposal-id}))
)

(define-public (set-vote (for bool) (voter principal) (proposal-id uint))
	(let
		(
			(proposal (unwrap! (get-proposal proposal-id) err-unknown-proposal))
			(previous-vote (get-vote voter proposal-id))
		)
		(try! (is-contract-owner))
		(asserts! (< block-height (get end-height proposal)) err-voting-ended)
		(map-set proposal-votes {voter: voter, proposal-id: proposal-id} {vote-height: block-height, for: for})
		
		;; If the new vote is the same as the previous vote, return (ok true) early.
		(asserts! (not (is-eq (some for) (get for previous-vote))) (ok true))

		;; Update vote count. If there was a previous vote, then subtract it.
		;; If the code enters into this expression, then the previous vote must
		;; be opposite of the new vote. (Because of the prior assertion.)
		(if for
			(map-set proposals proposal-id (merge proposal
				{
				yes-votes: (+ (get yes-votes proposal) u1),
				no-votes: (- (get no-votes proposal) (if (is-some previous-vote) u1 u0))
				})
			)
			(map-set proposals proposal-id (merge proposal
				{
				yes-votes: (- (get yes-votes proposal) (if (is-some previous-vote) u1 u0)),
				no-votes: (+ (get no-votes proposal) u1)
				})
			)
		)
		(ok true)
	)
)
```

**Privileged contract**

The privileged contract is meant to become the `contract-owner` of the storage
contract above. It will then be the contract that the members interact with. It
checks if the required conditions to submit a proposal or cast a vote are met
and will call into the storage contract to update the state. To keep the code
short, member handling logic has again been omitted. Additionally, in a real
scenario the privileged contract would need some kind of mechanism to change the
`contract-owner` of the storage contract. How this would work will depend on the
project. Perhaps the members have to signal the switch, or it could even be
managed by a DAO.

Assuming such `contract-owner` update logic exists, one can see how a modular
approach to smart contract design greatly improves flexibility. Were the
developers of this hypothetical project to introduce NFTs in the future, they
could deploy a new privileged contract that requires the `tx-sender` to own an
NFT in order to be able to submit a proposal.

```clarity,{"nonplayable":true}
(define-constant err-not-whitelisted (err u200))
(define-constant err-not-member (err u201))

(define-constant proposal-duration u1440)

(define-map members principal bool)
(define-map whitelisted-members principal bool)

(define-public (submit-proposal (title (string-ascii 100)))
	(begin
		(asserts! (default-to false (map-get? whitelisted-members tx-sender)) err-not-whitelisted)
		(contract-call? .proposal-storage insert-proposal title (+ block-height proposal-duration) tx-sender)
	)
)

(define-public (vote (for bool) (proposal-id uint))
	(begin
		(asserts! (default-to false (map-get? members tx-sender)) err-not-member)
		(contract-call? .proposal-storage set-vote for tx-sender proposal-id)
	)
)

;; tx-sender is the contract deployer on the top level, so we can immediately
;; make the privileged contract the contract-owner of the storage contract.
(contract-call? .proposal-storage set-contract-owner (as-contract tx-sender))
```

### Statelessness

Making a project modular is important but one can detect issues even with the
previous example; namely, the privileged contract still contains state
concerning user membership. Migrating state from one contract to another is
tedious and perhaps virtually impossible depending on the amount of data.
Statelessness is achieved by extracting just the business logic and turning that
into a separate contract. The `members` and `whitelisted-members` data maps can
also be moved to a new contract—or perhaps even the existing storage
contract—which is then queried by the privileged contract.

```clarity,{"nonplayable":true}
(define-constant err-not-owner (err u100))
(define-constant err-not-member (err u102))

(define-data-var contract-owner principal tx-sender)
(define-map members principal bool)
(define-map whitelisted-members principal bool)

(define-read-only (is-contract-owner)
    (ok (asserts! (is-eq contract-caller (var-get contract-owner)) err-not-owner))
)

(define-read-only (get-contract-owner)
    (var-get contract-owner)
)

(define-read-only (is-member (who principal))
	(asserts! (default-to false (map-get? members who)) err-not-member)
)

(define-read-only (is-whitelisted (who principal))
	(default-to false (map-get? whitelisted-members who))
)

(define-public (set-member (is-member bool) (who principal))
	(begin
		(try! (is-contract-owner))
		(ok (map-set members who is-member))
	)
)

(define-public (set-whitelisted (is-whitelisted bool) (who principal))
	(begin
		(try! (is-contract-owner))
		(ok (map-set whitelisted-members who is-whitelisted))
	)
)
```

The assertions in the privileged contracts are then to be replaced by contract
calls to the member storage contract:

```clarity,{"nonplayable":true}
(try! (contract-call? .member-storage is-member tx-sender))
```

### Hardcoded principals

Hardcoding principals in your contracts is another way in which two contracts
become more tightly coupled. We saw such tight coupling in the privileged
contract of the previous example. It contains a hardcoded link to the proposal
storage contract and later the member storage contract. Since the privileged
contract is now completely stateless, it will be more easily to replace with a
new contract in the future. Still, let us imagine that we want to remove the
hardcoded principals so that we can swap them out in the future. In chapter 9 we
learned about [dynamic dispatch](ch09-03-passing-traits.md#dynamic-dispatch).
The solution is therefore to move the contract principals themselves to data
variables and use trait references to call into the appropriate storage
contract.

The final vote function and surrounding code would look something like this.

```clarity,{"nonplayable":true}
(define-data-var member-storage-principal .member-storage)
(define-data-var proposal-storage-principal .proposal-storage)
(define-constant err-invalid-member-storage-reference (err u200))
(define-constant err-invalid-proposal-storage-reference (err u201))

(define-trait member-storage-trait
	(
		(is-member (principal) (response bool uint))
		;; And the rest of the functions...
	)
)

(define-trait proposal-storage-trait
	(
		(set-vote (bool principal uint) (response bool uint))
		;; And the rest of the functions...
	)
)

(define-public (vote (for bool) (proposal-id uint) (member-storage-ref <member-storage-trait>) (proposal-storage-ref <proposal-storage-trait>))
    (begin
		(asserts! (is-eq (contract-of member-storage-ref) (var-get member-storage-principal)) err-invalid-member-storage-reference)
		(asserts! (is-eq (contract-of proposal-storage-ref) (var-get proposal-storage-principal)) err-invalid-proposal-storage-reference)
        (try! (contract-call? member-storage-ref is-member tx-sender))
        (contract-call? proposal-storage-ref set-vote for tx-sender proposal-id)
    )
)

;; And the rest of the contract...
```

It does introduce some state back into the contract, but those variables are
exclusively used internally.

### Contract deployer reliance

A pattern often seen in Clarity smart contracts is to store the contract
deployer in a variable, like so:

```clarity,{"nonplayable":true}
(define-constant contract-deployer tx-sender)
```

The constant is then later used for authorisation purposes. Such a set up is
rather brittle if it is a single-signature or _n-of-n_ multi-signature
principal. The original deployer or deployers could potentially lose the private
key in the future rendering the authorised functions inaccessible forever. If
the upgrade mechanism requires can only be invoked by the contract deployer,
then it puts the project in a tough situation. While the most effective solution
depends on the project, one should always consider the ramifications of key
loss. A straightforward stategy is to implement a multi-principal ownership
model as seen in the
[multi-signature vault practice project](ch08-03-multi-signature-vault.md) or to
make grant authorised access to a contract with DAO-like capabilities.
