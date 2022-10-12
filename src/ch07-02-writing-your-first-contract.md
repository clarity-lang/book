## Writing your first smart contract

Now that we have the project setup out of the way, let us jump into writing our
first contract.

Open up the `counter.clar` file inside the `contracts` directory.

### Defining the data store

A [map](ch04-03-maps.md) will be used to store the individual counter values.
Maps are a great choice because data can be added as more principals call into
the contract over time.

```Clarity,{"nonplayable":true}
(define-map counters principal uint)
```

Our map is called `counters`, it is indexed by a key of the
[principal type](ch02-01-primitive-types.md#principals) and contains an
[unsigned integer](ch02-01-primitive-types.md#unsigned-integers). Since our
counter will always count up, using an unsigned integer as opposed to a signed
integer makes the most sense. The map thus relates a principal to a number.

We will also add a [read-only function](ch05-03-read-only-functions.md) that
returns the counter value for a specified principal. If the principal does not
exist in the map, we return a default value of `u0`. Clarity has a built-in
function called `default-to` that takes a default value and an
[optional type](ch02-03-composite-types.md#optionals). If the optional type is a
`(some ...)`, it will unwrap and return it. If it is a `none`, then it will
return the specified default value.

```Clarity,{"nonplayable":true}
(define-read-only (get-count (who principal))
	(default-to u0 (map-get? counters who))
)
```

Since `map-get?` returns either a `(some ...)` if the value is found or `none`
otherwise, it is perfect to directly plug into `default-to`.

### Creating the public function

The next step is to create the `count-up` function that will increment the
counter for the `tx-sender`. We will simply have the function return a `true`
status. (Remember,
[overflows cause an abort automatically](ch00-00-introduction.md#clarity-guards-against-overflow-and-underflows),
so we do not have to deal with it ourselves.) We already created a really useful
read-only function that we can repurpose. All we got to do is to set the map
value for the `tx-sender` to be equal to the current counter value incremented
by `u1`.

```Clarity,{"nonplayable":true}
(define-public (count-up)
	(begin
		(map-set counters tx-sender (+ (get-count tx-sender) u1))
		(ok true)
	)
)
```

Looks great! But we can simplify it further. The `map-set` actually returns a
boolean value so we could wrap it in an `ok` to cut down on the lines of code.
The refactored function therefore looks like this:

```Clarity,{"nonplayable":true}
(define-public (count-up)
	(ok (map-set counters tx-sender (+ (get-count tx-sender) u1)))
)
```

### Putting it together

Our first contract turned out to be surprisingly simple. That is the power of
Clarity. Let us put the entire contract together so that we can start testing
it.

```Clarity
;; Multiplayer Counter contract

(define-map counters principal uint)

(define-read-only (get-count (who principal))
	(default-to u0 (map-get? counters who))
)

(define-public (count-up)
	(ok (map-set counters tx-sender (+ (get-count tx-sender) u1)))
)
```

If we made any typos along the way, then the Clarity for VSCode Extension should
have highlighted them. Still, we can use Clarinet to validate our contract by
running the check command:

```bash
clarinet check
```

The command will output any errors it finds or nothing if the contract is in
order. No errors? Great, it is high time to play around with our contract.
