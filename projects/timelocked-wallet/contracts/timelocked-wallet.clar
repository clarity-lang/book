;; timelocked-wallet
;; A time-locked vault contract that becomes eligible to claim by the beneficiary after a certain block-height has been reached.

;; Owner
(define-constant contract-owner tx-sender)

;; Errors
(define-constant err-owner-only (err u100))
(define-constant err-already-locked (err u101))
(define-constant err-unlock-in-past (err u102))
(define-constant err-no-value (err u103))
(define-constant err-beneficiary-only (err u104))
(define-constant err-unlock-height-not-reached (err u105))

;; Data
(define-data-var beneficiary (optional principal) none)
(define-data-var unlock-height uint u0)

(define-public (lock (new-beneficiary principal) (unlock-at uint) (amount uint))
	(begin
		(asserts! (is-eq tx-sender contract-owner) err-owner-only)
		(asserts! (is-none (var-get beneficiary)) err-already-locked)
		(asserts! (> unlock-at block-height) err-unlock-in-past)
		(asserts! (> amount u0) err-no-value)
		(try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
		(var-set beneficiary (some new-beneficiary))
		(var-set unlock-height unlock-at)
		(ok true)
	)
)

(define-public (bestow (new-beneficiary principal))
	(begin
		(asserts! (is-eq (some tx-sender) (var-get beneficiary)) err-beneficiary-only)
		(var-set beneficiary (some new-beneficiary))
		(ok true)
	)
)

(define-public (claim)
	(begin
		(asserts! (is-eq (some tx-sender) (var-get beneficiary)) err-beneficiary-only)
		(asserts! (>= block-height (var-get unlock-height)) err-unlock-height-not-reached)
		(as-contract (stx-transfer? (stx-get-balance tx-sender) tx-sender (unwrap-panic (var-get beneficiary))))
	)
)
