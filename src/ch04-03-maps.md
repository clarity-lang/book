## Maps

Data maps are so-called
_[hash tables](https://en.wikipedia.org/wiki/Hash_table)_. It is a kind of data
structure that allows you to map keys to specific values. Unlike tuple keys,
data map keys are not hard-coded names. They are represented as a specific
concrete values. You should use maps if you want to relate data to other data.

A map is defined using `define-map`:

```Clarity,{"nonplayable":true}
(define-map map-name key-type value-type)
```

Both `key-type` and `value-type` can be any valid type signature, although
tuples are normally used because of their versatility.

```Clarity
;; A map that creates a principal => uint relation.
(define-map balances principal uint)

;; Set the "balance" of the tx-sender to u500.
(map-set balances tx-sender u500)

;; Retrieve the balance.
(print (map-get? balances tx-sender))
```

Let us take a look at how we can use a map to store and read basic orders by ID.
We will use an unsigned integer for the key type and a tuple for the value type.
These fictional orders will hold a principal and an amount.

```Clarity
(define-map orders uint {maker: principal, amount: uint})

;; Set two orders.
(map-set orders u0 {maker: tx-sender, amount: u50})
(map-set orders u1 {maker: tx-sender, amount: u120})

;; retrieve order with ID u1.
(print (map-get? orders u1))
```

It is important to know that maps are not iterable. In other words, you cannot
loop through a map and retrieve all values. The only way to access a value in a
map is by specifying the right key.

Keys can be as simple or complex as you want them to be:

```Clarity
(define-map highest-bids
	{listing-id: uint, asset: (optional principal)}
	{bid-id: uint}
)

(map-set highest-bids {listing-id: u5, asset: none} {bid-id: u20})
```

Whilst tuples make the code more readable, remember that Clarity is interpreted.
Using a tuple as a key incurs a higher execution cost than using a
[primitive type](ch02-01-primitive-types.md). If your tuple key has only one
member, consider using the member type as the map key type directly.

### Set and insert

The `map-set` function will overwrite existing values whilst `map-insert` will
do nothing and return `false` if the specified key already exists. Entries may also be deleted using
`map-delete`.

```Clarity
(define-map scores principal uint)

;; Insert a value.
(map-insert scores tx-sender u100)

;; This second insert will do nothing because the key already exists.
(map-insert scores tx-sender u200)

;; The score for tx-sender will be u100.
(print (map-get? scores tx-sender))

;; Delete the entry for tx-sender.
(map-delete scores tx-sender)

;; Will return none because the entry got deleted.
(print (map-get? scores tx-sender))
```

### Reading from a map might fail

What we have seen from the previous examples is that `map-get?` returns an
[optional type](ch02-03-composite-types.md#optionals). The reason is that
reading from a map fails if the provided key does not exist. When that happens,
`map-get?` returns a `none`. It also means that if you wish to use the retrieved
value, you will have to unwrap it in most cases.

```Clarity
;; A map that creates a string-ascii => uint relation.
(define-map names (string-ascii 34) principal)

;; Point the name "Clarity" to the tx-sender.
(map-set names "Clarity" tx-sender)

;; Retrieve the principal related to the name "Clarity".
(print (map-get? names "Clarity"))

;; Retrieve the principal for a key that does not exist. It will return `none`.
(print (map-get? names "bogus"))

;; Unwrap a value:
(print (unwrap-panic (map-get? names "Clarity")))
```

The chapter that discusses the different
[unwrap flavours](ch06-03-unwrap-flavours.md) goes more into what unwrapping
means.
