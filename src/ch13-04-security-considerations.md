# Security Considerations

Smart contract security is paramount in blockchain development. Unlike traditional
software, smart contracts are immutable once deployed and often handle valuable
assets. A single vulnerability can lead to significant financial losses. This
chapter covers essential security considerations for Clarity developers.

## Common Vulnerabilities

### Reentrancy Prevention

While Clarity's design makes traditional reentrancy attacks more difficult than
in other smart contract languages, developers should still be cautious when
making external contract calls.

```clarity
;; Vulnerable: State change after external call
(define-public (withdraw (amount uint))
  (begin
    ;; External call happens first
    (try! (contract-call? .external-contract do-something))
    ;; State change happens after - could be exploited
    (map-set balances tx-sender (- (get-balance tx-sender) amount))
    (ok true)))

;; Secure: State change before external call
(define-public (withdraw (amount uint))
  (let ((current-balance (get-balance tx-sender)))
    ;; Validate first
    (asserts! (>= current-balance amount) (err u1))
    ;; Update state
    (map-set balances tx-sender (- current-balance amount))
    ;; External call last
    (try! (contract-call? .external-contract do-something))
    (ok true)))
```

### Integer Overflow/Underflow

Clarity has built-in protection against overflows, but you should handle
potential arithmetic errors gracefully.

```clarity
;; Using asserts to prevent underflow scenarios
(define-public (decrease-balance (amount uint))
  (let ((balance (get-balance tx-sender)))
    (asserts! (>= balance amount) (err u100))
    (ok (- balance amount))))
```

### Access Control

Always implement proper authorization checks for sensitive functions.

```clarity
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u401))

;; Pattern: Check authorization at the start of every admin function
(define-public (admin-only-function)
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
    ;; Rest of function logic
    (ok true)))
```

## Input Validation

Never trust external input. Always validate parameters before processing.

```clarity
;; Comprehensive input validation example
(define-public (create-listing (price uint) (expiry uint))
  (begin
    ;; Validate price is reasonable
    (asserts! (> price u0) (err u1))
    (asserts! (<= price u1000000000000) (err u2)) ;; Max price check
    
    ;; Validate expiry is in the future but not too far
    (asserts! (> expiry stacks-block-height) (err u3))
    (asserts! (< expiry (+ stacks-block-height u52560)) (err u4)) ;; ~1 year
    
    ;; Proceed with logic
    (ok true)))
```

## Secure Patterns

### Checks-Effects-Interactions

Follow this pattern for all state-changing functions:

1. **Checks**: Validate all conditions first
2. **Effects**: Update contract state
3. **Interactions**: Call external contracts last

```clarity
(define-public (transfer (amount uint) (recipient principal))
  (let ((sender-balance (get-balance tx-sender)))
    ;; 1. CHECKS
    (asserts! (> amount u0) (err u1))
    (asserts! (>= sender-balance amount) (err u2))
    (asserts! (not (is-eq tx-sender recipient)) (err u3))
    
    ;; 2. EFFECTS
    (map-set balances tx-sender (- sender-balance amount))
    (map-set balances recipient 
      (+ (default-to u0 (map-get? balances recipient)) amount))
    
    ;; 3. INTERACTIONS (if any external calls needed)
    (ok true)))
```

### Pull Over Push

When distributing funds to multiple recipients, prefer letting them withdraw
rather than pushing funds.

```clarity
;; Vulnerable: Push pattern - can fail if one recipient is a contract
(define-public (distribute-funds (recipients (list 10 principal)) (amount uint))
  ;; If any transfer fails, entire transaction fails
  ...)

;; Secure: Pull pattern - recipients claim their own funds
(define-map claimable-funds principal uint)

(define-public (set-claimable (recipient principal) (amount uint))
  (begin
    (map-set claimable-funds recipient amount)
    (ok true)))

(define-public (claim-funds)
  (let ((amount (default-to u0 (map-get? claimable-funds tx-sender))))
    (asserts! (> amount u0) (err u1))
    (map-delete claimable-funds tx-sender)
    (try! (stx-transfer? amount (as-contract tx-sender) tx-sender))
    (ok amount)))
```

## Testing for Security

Always write tests that specifically target security scenarios.

```typescript
describe("security tests", () => {
  it("rejects unauthorized access to admin functions", () => {
    const result = simnet.callPublicFn(
      "contract",
      "admin-function",
      [],
      attackerAddress
    );
    expect(result.result).toBeErr(Cl.uint(401));
  });

  it("handles zero amount transfers correctly", () => {
    const result = simnet.callPublicFn(
      "contract",
      "transfer",
      [Cl.uint(0), Cl.principal(recipient)],
      sender
    );
    expect(result.result).toBeErr(Cl.uint(1));
  });

  it("prevents double-spending", () => {
    // Transfer all balance
    simnet.callPublicFn("contract", "transfer", [Cl.uint(100), ...], sender);
    // Try to transfer again - should fail
    const result = simnet.callPublicFn(
      "contract", 
      "transfer", 
      [Cl.uint(1), ...], 
      sender
    );
    expect(result.result).toBeErr(Cl.uint(2)); // Insufficient balance
  });
});
```

## Audit Checklist

Before deploying any contract to mainnet, verify:

- [ ] All public functions have proper access control
- [ ] All inputs are validated
- [ ] No unbounded loops exist
- [ ] State changes occur before external calls
- [ ] Error codes are well-defined and documented
- [ ] Edge cases are handled (zero values, max values, empty lists)
- [ ] Contract has been tested with malicious inputs
- [ ] Code has been reviewed by another developer
- [ ] Consider getting a professional audit for high-value contracts
