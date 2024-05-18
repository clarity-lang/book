## Public functions

Public functions are callable from the outside by both standard principals and
contract principals. Contracts that feature any interactivity will need at least
one public function. The fact of them being callable does not imply that the
_underlying functionality_ is public. The developer can include assertions to
make sure that only specific [contract callers](ch03-00-keywords.md) or inputs
are valid.

Public functions _**must**_ return a
[response type](ch02-03-composite-types.md#responses) value. If the function
returns an `ok` type, then the function call is considered valid, and any
changes made to the blockchain state will materialise. It means that state
changes such as updating variables or transferring tokens will _**only**_ be
committed to the chain if the contract call that triggered these changes returns
an `ok`.

The effects of returning an `ok` or an `err` are illustrated by the example
below. It is a basic function that takes an unsigned integer as an input and
will return an `ok` if it is even or an `err` if it is odd. It will also
increment a variable called `even-values` at the start of the function. To check
if the number is even, we calculate the remainder of a division by two and check
that it is equal to zero using the `is-eq` function (_n mod 2 should equal 0_).

```Clarity
(define-data-var even-values uint u0)

(define-public (count-even (number uint))
	(begin
		;; increment the "event-values" variable by one.
		(var-set even-values (+ (var-get even-values) u1))
		
		;; check if the input number is even (number mod 2 equals 0).
		(if (is-eq (mod number u2) u0)
			(ok "the number is even")
			(err "the number is odd")
		)
	)
)

;; Call count-even two times.
(print (count-even u4))
(print (count-even u7))

;; Will this return u1 or u2?
(print (var-get even-values))
```

Did you notice how the final print expression returned `u1` and not `u2`, even
though the `count-even` function is called twice? If you are used to programming
in a different language, for example JavaScript, then it might strike you as
odd: the `even-values` variable is updated at the start of the function so it
seems intuitive that the number should increment on every function call.

Edit the example above and try going through the following iterations:

- Replace the odd number `u7` with an even number like `u8`. Does the
  printout of `even-values` contain `u1` or `u2`?
- Change the `err` type in the `if` expression to an `ok`. What is the value of
  `even-values` then?

What happens is that the entire public function call is rolled back or
_reverted_ as soon as it returns an `err` value. It is as if the function call
never happened! It therefore does not matter if you update the variable at the
start or end of the function.

Understanding responses and how they can affect the chain state is key to being
a successful smart contract developer. The chapter on error handling will go in
greater detail on how to guard your functions and the exact control flow.

```Clarity,{"validation_code":"(asserts! (is-eq (sum-three u3 u5 u7) (ok u15)) \"That does not seem right, try again...\")\n(asserts! (is-eq (sum-three u20 u30 u40) (ok u90)) \"Almost there, try again!\")","hint":"Write a function called 'sum-three' that sums 3 unsigned integers."}
(define-public (sum-three)

)

(print (sum-three u3 u5 u9))
```
