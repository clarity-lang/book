## Private functions

Private functions are defined in the same manner as public functions. The
difference is that they can only be called by the current contract. They cannot
be called from other smart contracts, nor can they be called directly by sending
a transaction. Private functions are useful to create utility or helper
functions to cut down on code repetition. If you find yourself repeating
similar expressions in multiple locations, then it is worth considering turning
those expressions into a separate private function.

The contract below allows only the contract owner to update the `recipients`
map via two public functions. Instead of having to repeat the `contract-caller` check,
it is _abstracted away_ to its own private function called `is-valid-caller`.

```Clarity
(define-constant contract-owner tx-sender)

;; Try removing the contract-owner constant above and using a different
;; one to see the example calls error out:
;; (define-constant contract-owner 'ST20ATRN26N9P05V2F1RHFRV24X8C8M3W54E427B2)

(define-constant err-invalid-caller (err u1))

(define-map recipients principal uint)

(define-private (is-valid-caller)
	(is-eq contract-owner contract-caller)
)

(define-public (add-recipient (recipient principal) (amount uint))
	(if (is-valid-caller)
		(ok (map-set recipients recipient amount))
		err-invalid-caller
	)
)

(define-public (delete-recipient (recipient principal))
	(if (is-valid-caller)
		(ok (map-delete recipients recipient))
		err-invalid-caller
	)
)

;; Two example calls to the public functions:
(print (add-recipient 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK u500))
(print (delete-recipient 'ST1J4G6RR643BCG8G8SR6M2D9Z9KXT2NJDRK3FBTK))
```

Another good reason to define private functions is to reduce overall function
complexity. Large public functions can be harder to maintain and are more prone
to developer error. Splitting such functions up into a public function and a
number of smaller private functions can alleviate these issues.

Private functions may return any type, including responses, although returning
an `ok` or an `err` will have no effect on the materialised state of the chain.

```Clarity,{"validation_code":"(asserts! (not (is-valid-caller contract-caller)) "That does not seem right, try again...")\n(asserts! (is-valid-caller 'ST20ATRN26N9P05V2F1RHFRV24X8C8M3W54E427B2) "Almost there, try again!")","hint": "Write a private function called 'is-valid-caller' that returns true or false based on whether the contract-caller is one of the authorised principals."}
(define-constant err-invalid-caller (err u1))

(define-map authorised-callers principal bool)
(define-map recipients principal bool)

(map-set recipients tx-sender true)
(map-set authorised-callers 'ST20ATRN26N9P05V2F1RHFRV24X8C8M3W54E427B2 true)

(define-private (is-valid-caller (caller principal))
	;; Implement.
)

(define-public (delete-recipient (recipient principal))
	(if (is-valid-caller contract-caller)
		(ok (map-delete recipients recipient))
		err-invalid-caller
	)
)

(print (delete-recipient tx-sender))
```
