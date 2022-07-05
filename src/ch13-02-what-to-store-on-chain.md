## What to store on-chain

Smart contracts are a special breed of resource-constraint systems. Developers
that just enter the blockchain space usually bring with them certain assumptions
that may not be valid when writing smart contracts. It is paramount to remember
that a blockchain is distributed data storage _over time_. Every state change is
_paid for_ in terms of the miner fee.

### Data storage

The user pays for every byte of storage that is written to the chain, which
means that you naturally want to keep the amount of data therefore to a minimum.
However, before you try to optimise the _amount_ of data, you should actually
think about the _type_ of data you want to store. Ask yourself if the data
should exist on-chain in the first place. It is a common trap to think that in
order for all data of your app to be immutable and trustless, it has to be
stored in a smart contract.

Imagine you are making a job board application that does job matching on-chain.
A job posting has a title, description, information on who posted it and so on.
Should you really start defining complicated data maps like this?

```Clarity,{"nonplayable":true}
(define-map jobs
	uint
	{
		poster: principal,
		title: (string-utf8 200),
		description: (string-utf8 10000),
		posting-date: (string-utf8 12),
		expiry-date: (string-utf8 12),
		vacancies: uint,
		salary-range-lower: uint,
		salary-range-upper: uint
		;; And so on...
	}
)
```

Definitely not! If the `(string-utf8 10000)` does not already tick you off, then
consider the following: what if your app has been running for a couple of months
and there is a need to introduce some new fields? You cannot simply update the
contract and migrating the data already present in the map to a new contract is
going to be a serious operation.

What should you do instead? If you care about the integrity of your job posting,
then submitting a _hash of the data_ to the contract is sufficient. The job data
itself can live in off-chain storage and your app will compare a hash of the
data with the hash that is stored on-chain. If they differ then there was an
unauthorised change. The principal that posted the job can still update the job
information by submitting the updated hash to the contract.

Here is what that part of the contract could look like:

```Clarity,{"nonplayable":true}
(define-map jobs
	uint
	{
		poster: principal,
		data-hash: (buff 32)
	}
)

(define-read-only (get-job-hash (job-id uint))
	(get data-hash (map-get? jobs job-id))
)

(define-public (update-job-posting (job-id uint) (new-data-hash (buff 32)))
	(begin
		(asserts! (is-eq (get poster (map-get? jobs job-id)) (some tx-sender)) (err u100)) ;; not the poster
		(ok (map-set jobs job-id {poster: tx-sender, data-hash: new-data-hash}))
	)
)
```

And some pseudo-code of the client-side:

```javascript
function validate_job(job_id, data) {
  let hash = sha256(data);
  return hash === contract_read({
    contract_address,
    function_name: "get-job-hash",
    function_args: [uintCV(job_id)],
  });
}

function update_job(job_id, data) {
  let hash = sha256(data);
  return broadcast_contract_call({
    contract_address,
    function_name: "update-job-posting",
    function_args: [uintCV(job_id), buffCV(hash)],
  });
}
```

### Historical data

The blockchain by virtue of its fundamental principles already stores the full
history. Smarts contracts therefore do not usually have to track a history of
something themselves. If you are building an on-chain auction, for example, you
may want to track the history of the highest bids. Maybe you store the highest
bid in a variable and you add the previous highest bids in a list (bad) or a map
(less bad). No need! The built-in function `at-block` allows you go to back in
time. It changes the context to what the chain state was at the specified block,
allowing you to see what the highest bid variable contained.

```Clarity,{"nonplayable":true}
(define-constant err-bid-too-low (err u100))
(define-constant err-invalid-block (err u101))

(define-data-var highest-bid
	{bidder: principal, amount: uint}
	{bidder: tx-sender, amount: u0}
)

(define-public (bid (amount uint))
	(begin
		(asserts! (> amount (get amount (var-get highest-bid))) err-bid-too-low)
		(ok (var-set highest-bid {bidder: tx-sender, amount: amount}))
	)
)

(define-read-only (get-highest-bid)
	(var-get highest-bid)
)

(define-read-only (get-highest-bid-at (historical-block-height uint))
	(at-block
		(unwrap! (get-block-info? id-header-hash historical-block-height) err-invalid-block)
		(ok (get-highest-bid))
	)
)
```
