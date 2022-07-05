## Read-only functions

Read-only functions can be called by the contract itself, as well as from the
outside. They can return any type, just like private functions.

As the name implies, _read-only_ functions may only perform read operations. You
can read from data variables and maps but you _cannot_ write to them. Read-only
functions can also be purely _functional;_ that is to say, calculate some result
based on an input and return it. This is fine:

```Clarity
(define-read-only (add (a uint) (b uint))
	(+ a b)
)

(print (add u5 u10))
```

And so is this:

```Clarity
(define-data-var counter uint u0)

(define-read-only (get-counter-value)
	(var-get counter)
)

(print (get-counter-value))
```

But this one _**not**_ so much:

```Clarity
(define-data-var counter uint u0)

(define-read-only (increment-counter)
	(var-set (+ (var-get counter) u1))
)

(print (increment-counter))
```

As you can see, the analysis tells us it detected a writing operation inside a
read-only function:

> Analysis error: expecting read-only statements, detected a writing operation
> (define-data-var counter uint u0)

Not to worry though, there is no way to mess that up. If analysis fails the
contract is rendered invalid, which means it cannot be deployed on the network.

One thing that makes read-only functions very interesting is that they can be
called _without_ actually sending a transaction! By using read-only functions,
you can read the contract state for your application without requiring your
users to pay transaction fees.
[Stacks.js](https://github.com/blockstack/stacks.js) and the
[Web Wallet Extension](https://www.hiro.so/wallet/install-web) have support for
calling read-only functions built-in. You can try it yourself right now with the
[Stacks Sandbox](https://explorer.stacks.co/sandbox/contract-call). Find a
contract with a read-only function and call it directly. Completely free!

```Clarity,{"validation_code":"(asserts! (is-eq (get-counter-of 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK) u5) \"That does not seem to be right, try again...\")\n(asserts! (is-eq (get-counter-of 'ST20ATRN26N9P05V2F1RHFRV24X8C8M3W54E427B2) u10) \"Almost there, keep going!\")\n(asserts! (is-eq (get-counter-of 'ST21HMSJATHZ888PD0S0SSTWP4J61TCRJYEVQ0STB) u0) \"get-counter-of should return u0 if the principal does not exist in the map.\")","hint":"Create a read-only function that returns the counter value for a given principal, or u0 if the principal does not exist in the map."}
(define-map counters principal uint)

(map-set counters 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK u5)
(map-set counters 'ST20ATRN26N9P05V2F1RHFRV24X8C8M3W54E427B2 u10)

(define-read-only (get-counter-of (who principal))
	;; Implement.
)

;; These exist:
(print (get-counter-of 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK))
(print (get-counter-of 'ST20ATRN26N9P05V2F1RHFRV24X8C8M3W54E427B2))

;; This one does not:
(print (get-counter-of 'ST21HMSJATHZ888PD0S0SSTWP4J61TCRJYEVQ0STB))
```
