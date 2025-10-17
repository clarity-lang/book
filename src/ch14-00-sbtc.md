# sBTC

## General information

sBTC is the wrapped Bitcoin token. It is compatible with SIP-010 and it is
defined by mainnet contract `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`.

Detailed information about sBTC are available at [stacks.co](https://docs.stacks.co/concepts/sbtc).

## Using sBTC

Check out the dedicated [guide](https://docs.hiro.so/stacks/clarinet/guides/working-with-sbtc) to developing locally with sBTC.

### Unit tests with sBTC

The following snippets verifies that 1 sBTC was successfully transferred from Alice to Bob. The mainnet contract is automatically mapped to the appropriate contract for unit tests in simnet.

```typescript
let block = simnet.mineBlock([
  tx.callPublicFn(
    "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
    "transfer",
    [uintCV(100_000_000), principalCV(alice), principalCV(bob), noneCV()],
    alice
  ),
]);

expect(block[0].result).toBeOk(true);
```
