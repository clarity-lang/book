# Runtime cost analysis

Every transaction executed on-chain comes at a cost. Miners run and verify
transactions, levying _transaction fees_ for their work. These costs should be
very familiar to anyone who has ever interacted with a blockchain.

But there are other costs that not many are aware of. They are called _execution
costs_ and each block is limited by them. In addition to block size, these are
what limit the number of transactions that can fit into a single block. They are
also used to reduce resource consumption when calling read-only functions.

## Execution costs

In **Clarity**, execution costs are broken up into five different categories, 
each with its own limit.

```txt
+----------------------+--------------+-----------------+
|                      | Block Limit  | Read-Only Limit |
+----------------------+--------------+-----------------+
| Runtime              | 5000000000   | 1000000000      |
+----------------------+--------------+-----------------+
| Read count           | 15000         | 30             |
+----------------------+--------------+-----------------+
| Read length (bytes)  | 100000000    | 100000          |
+----------------------+--------------+-----------------+
| Write count          | 15000         | 0              |
+----------------------+--------------+-----------------+
| Write length (bytes) | 15000000     | 0               |
+----------------------+--------------+-----------------+
```

**Runtime costs** limits overall complexity of the code that can be executed.
For example, negating a boolean value is less complex than calculating SHA512
hash, therefore `(not false)` will consume less runtime costs than
`(sha512 "hello world")` . This category is also affected by contract size.

**Read count** limits how many times we can read from memory or chain state
to a extract piece of information. It is affected by reading constants, 
variables, intermediate variables created with `let` , maps, but also by some
functions that needs to save intermediate results during execution.

**Read length (bytes)** limits how much data we can read from memory or the
chain. It is also affected by contract size. Calling into a contract using
`contract-call?` Increases the read length by an amount equal to the contract
size in bytes, _every time_. If you call into a contract with a length of 2, 000
bytes twice, the read length is increased twice.

**Write count** limits how many times we can write data into chain. It
increments when writing to variables and maps.

**Write length (bytes)** limits how much data we can write to the chain.

Read and write limits are self explanatory and practically static. The more data
we read and write, the closer we get to the limits. Runtime costs are more
dynamic, and more difficult to grasp as each Clarity function has its own
runtime cost. For some it is static, and for the others it changes based on how
much data they have to process. For example, the `not` function always takes
exactly one boolean and does the same amount of work, while `filter` takes an
iterator function and a list that can contain a number of elements, making the
amount of work required dynamic.

Developers have to be careful with how they structure their code, which
functions they use, and they use them, as it is quite easy to write code that is
entirely correct, yet so expensive to execute that it will eat significant
portion of execution costs set for all transactions in a block. As a result, the
function may only be able to be called a few times per block—not to mention
having to compete with others for such a large chunk of the block.

## Analysis using Clarinet

Analysis costs can be challenging, so it is important to have good tooling.
Clarinet has cost analysis features built-in which make the development
lifecycle a lot easier. We will take a look at manual as well as automated cost
analysis tests.

### Manual analysis

You can get the costs of any expression manually by dropping into a console
session. Open the counter project from
[chapter 7.2](ch07-02-writing-your-first-contract.md) and start a session with
`clarinet console` . Remember that you can type `::help` to see REPL commands.
In there, you will find a command to analyse the costs of an expression:

```txt
::get_costs <expr>                      Display the cost analysis
```

You can put the command in front of any Clarity expression to tell the REPL that
you also want to see the execution costs. Let us try it with the `not` function
to negate a `false` value:

```clarity,{"nonplayable":true}
>> ::get_costs (not false)
+----------------------+----------+------------+
|                      | Consumed | Limit      |
+----------------------+----------+------------+
| Runtime              | 186      | 5000000000 |
+----------------------+----------+------------+
| Read count           | 0        | 15000      |
+----------------------+----------+------------+
| Read length (bytes)  | 0        | 100000000  |
+----------------------+----------+------------+
| Write count          | 0        | 15000      |
+----------------------+----------+------------+
| Write length (bytes) | 0        | 15000000   |
+----------------------+----------+------------+

true
```

As you can see, the `not` function consumed 186 runtime units. All the others
are zero because the not function does not read or write anything.

Next, let us try calling the `sha512` function with an input uint of `u1234`.

```clarity,{"nonplayable":true}
>> ::get_costs (sha512 u1234)
+----------------------+----------+------------+
|                      | Consumed | Limit      |
+----------------------+----------+------------+
| Runtime              | 193      | 5000000000 |
+----------------------+----------+------------+
| Read count           | 0        | 15000      |
+----------------------+----------+------------+
| Read length (bytes)  | 0        | 100000000  |
+----------------------+----------+------------+
| Write count          | 0        | 15000      |
+----------------------+----------+------------+
| Write length (bytes) | 0        | 15000000   |
+----------------------+----------+------------+

0x523be47185d0ffe54cb649d4e6303db92f54d2949becd8b6c0c91830006523b155fd9eaad1095c0f208012c9fffd6618e5730caf511cfc41786005089c0dc013
```

It thus appears that the `sha512` function is more expensive to execute than
`not`, which makes sense.

But we are not limited to just inline expressions. We can also get the runtime
cost of a contract call. Remember how to call `count-up`? Let us see what costs
are involved with updating the `counters` map.

```clarity,{"nonplayable":true}
>> ::get_costs (contract-call? .counter count-up)
+----------------------+----------+------------+
|                      | Consumed | Limit      |
+----------------------+----------+------------+
| Runtime              | 6692     | 5000000000 |
+----------------------+----------+------------+
| Read count           | 5        | 15000      |
+----------------------+----------+------------+
| Read length (bytes)  | 418      | 100000000  |
+----------------------+----------+------------+
| Write count          | 1        | 15000      |
+----------------------+----------+------------+
| Write length (bytes) | 165      | 15000000   |
+----------------------+----------+------------+

(ok true)
```

Quite the difference from the above. Explaining all the exact numbers is a bit
tough but we can make a few deductions:

- Loading the contract into memory affects the the runtime and read dimensions.
- Reading the map via `map-get?`, as found in the `get-count` function, adds to
  the read dimensions.
- The `count-up` function calls `map-set` and writes a new value, which is
  evident from the write count of one.

### Automated analysis

Clarinet can automatically run cost analysis on test. As long as your unit tests
are comprehensive, then you do not need to do anything special to make use of
this feature. The unit tests we wrote in
[chapter 7.4](ch07-04-testing-your-contract.md) can be executed while also
analysing costs by adding the `--costs` option. The full command is thus as
follows: `clarinet test --costs`. You will see that a costs analysis table will
be printed after the result of the unit tests.

```clarity,{"nonplayable":true}
Running counter/tests/counter_test.ts
* get-count returns u0 for principals that never called count-up before ... ok (5ms)
* count-up counts up for the tx-sender ... ok (6ms)
* counters are specific to the tx-sender ... ok (13ms)

test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out (382ms)

Contract calls cost synthesis
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
|                                   | Runtime (units) | Read Count | Read Length (bytes) | Write Count | Write Length (bytes) | Tx per Block |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| counter::count-up                 |    6692 (0.00%) |  5 (0.03%) |         418 (0.00%) |   1 (0.01%) |          165 (0.00%) |         1550 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| counter::get-count                |    3213 (0.00%) |  4 (0.03%) |         418 (0.00%) |           0 |                    0 |         1937 |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
|                                                                                                                                            |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
| Mainnet Block Limits (Stacks 2.0) |      5000000000 |      15000 |           100000000 |       15000 |             15000000 |            / |
+-----------------------------------+-----------------+------------+---------------------+-------------+----------------------+--------------+
```

What makes the test method even more useful is that it also shows you the
percentage of the block budget each function consumes. That number is very
important as it shows you how many of these contract calls can fit in a single
block. And remember, every user of the blockchain competes for the same block
budget! If your function calls takes a good chunk of the block budget then
miners might elect to ignore your transaction so that it can fit a larger number
of transactions in the block. You should therefore strive to make the
percentages as low as possible.

## Optimising runtime cost

### Setting up a cost baseline

As was seen in the previous section, costs are influenced by various factors. It
can therefore be hard to trace exactly which parts of your smart contracts are
the largest contributors to the overall runtime cost. It can be a good idea to
add a cost baseline by temporarily including a simple function to the contract
you want to analyse. The cost dimensions of calling the function will then serve
as the minimum amount required to interact with your contract. Such a function
could look like this:

```clarity,{"nonplayable":true}
(define-read-only (a) true)
```

Clarity is an interpreted language, which means that the length of symbols also
has an effect on the runtime cost. That means that the length of function,
argument, and variable names must be taken into account. The baseline function
above has the shortest possible name `a` and returns the simplest type of
Clarity value; namely, a boolean.

Having a reference point is very important, especially when working with big
contracts, because in big contracts functions that should be cheap can be quite
expensive only due to contract size. You might thus erroneously assume there is
something wrong with your function when it is actually due to the sheer size of
the contract itself.

### Contracts that require a lot of upfront setup

More complicated smart contract systems might require a decent amount of upfront
work. Examples include adding initial values to data maps or by calling into
different contracts. These actions normally only need to happen once. If your
application demands such a setup then consider moving the setup logic into a
separate contract. The setup contract can then be deployed by itself and used to
initialise your project. Once the setup is completed, the application will run
more efficiently as the core contract is not bogged down by many lines of
initialising code. Not to mention that decoupling your setup logic can make
maintenance easier as well.

### Common optimisations

#### Remove code repetition

A general rule is to prevent code repetition. If you catch yourself copying and
pasting parts of a function then consider turning that logic into a separate
function.

#### Inline expressions

Any time a variable is defined using `let`, check if the variable is actually
used more than once. If not, inline the variable expression where it is used. It
might even be the case that the `let` expression itself can be replaced with a
cheaper one like `begin`.

#### Remove fake variables

You should only define contract variables with `define-data-var` if you actually
plan on changing the variables over the contract lifetime. Any variables that
are defined once and then only read can usually be replaced by constants defined
with `define-constant`.

#### Call into contracts as few times as possible

A pattern commonly observed is to have one contract that contains business logic
and another that is meant for storage. If a function you are writing calls into
a contract multiple times and you control the destination contract, then
consider rewriting both contracts such that only a single call is necessary. A
contrived example to highlight the change is as follows:

```Clarity,{"nonplayable":true}
(define-public (example-1)
	(let
		(
			;; Here the storage contract is called twice, which means
			;; the contract code is loaded twice, which in turn means
			;; the read dimension is incremented twice.
			(value-a (contract-call? .storage-contract get-value-a))
			(value-b (contract-call? .storage-contract get-value-b))
		)
		;; Business logic here...
		(ok true)
	)
)

(define-public (example-2)
	(let
		(
			;; Here the storage is called only once. Cost savings!
			(value-a-b (contract-call? .storage-contract get-value-a-and-b))
			;; The value returned is a tuple containing both values.
			(value-a (get a value-a-b))
			(value-b (get b value-a-b))
		)
		;; Business logic here...
		(ok true)
	)
)
```

### Further optimisation techniques

Reducing runtime cost can be as challenging as writing the smart contract in the
first place. There is no silver bullet for when a contract turns out to be
rather expensive to execute. Next to the more common optimisations, here are
some more techniques and tips to consider:

1. Reduce obvious code complexity. First write correct code, then work on the
   costs.
2. Reduce the amount of data to be read and written. Analyse what information
   actually needs to be stored and retrieved.
3. Reduce number of times the contract reaches for the same data. Do not read
   the same variables or map data multiple times.
4. Look at how data stored in data variables and maps is used in the contract.
   Split or combine them where it makes sense. If a data variable or map stores
   a tuple, see if you always need all fields.
5. Combine multiple contract calls to the same contract into single call if
   possible.
6. Inline or extract logic if you notice repetition.
7. Reducing the amount of data passed between functions. For example, if you
   only need one field of a tuple, pass just that value instead of the entire
   tuple.
8. See if reversing logic is cheaper. For example, instead of counting positive
   values in a list, it might be more cost effective to count zeros if it is
   expected that the list should consists of only positive values.
9. Unroll loops made with `map` and `fold` and see what difference it makes.
10. Reduce contract size by removing comments, using shorter names for
    functions, variables, and keys in tuples.

### Long term recommendations

Start with working code and focus on functionality first. Once that is done,
write tests and write a lot of them. Code refactoring is difficult and tests
help you make sure that your code behaves the same way before and after the
refactor. Bugs become exceedingly difficult to catch the more complicated the
project becomes. A complex function may break accidentally when it is
refactored. Furthermore, aim for low hanging fruits first by applying common
optimisation techniques. Avoid optimising complex functions as the smaller ones
may give you what you need. Small gains can accumulate very quickly and cause a
snowball effect. Reducing costs of one function by mere fraction may result in a
large cost reduction in another.

Code that is efficient in byte size—that is to say, takes up the least amount of
code—may often not be the most efficient in terms of runtime cost. For example,
if you execute a `fold` over a small list, but each element of that list is a
tuple, test if unwinding the code is cheaper to execute. You will find it to be
the case rather often. Unwinding a loop means to get rid of the iteration in
favour of sequential statements. The contract becomes larger in terms of actual
code but may be reduced in complexity. If you are unfamiliar with unwinding,
here is a very basic example of the process:

```Clarity,{"nonplayable":true}
(define-private (sum-values-iter (current uint) (previous uint))
	(+ previous current)
)

(define-read-only (sum-values (values (list 10 uint)))
	(fold sum-values-iter values u0)
)

;; Unwinding removes the iterative function `fold` .
(define-read-only (sum-values-unwind (values (list 10 uint)))
	(+
		(default-to u0 (element-at values u0))
		(default-to u0 (element-at values u1))
		(default-to u0 (element-at values u2))
		(default-to u0 (element-at values u3))
		(default-to u0 (element-at values u4))
		(default-to u0 (element-at values u5))
		(default-to u0 (element-at values u6))
		(default-to u0 (element-at values u7))
		(default-to u0 (element-at values u8))
		(default-to u0 (element-at values u9))
	)
)
```

Always remember that you should do as little on-chain as possible. You may find
that a read-only function does not fit into read-only limits. If the output of
the function is meant to be displayed in the frontend of your application, then
consider exposing the required contract data used by the function directly and
handle the actual calculations off-chain.
