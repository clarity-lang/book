# sBTC

## General information

sBTC is the wrapped Bitcoin token. It is compatible with SIP-010.
Detailed information about sBTC are available at [stacks.co](https://docs.stacks.co/concepts/sbtc).

## Using sBTC

### Unit tests with sBTC

The following function mints sBTC to the provided address. It uses clarigen types. Therefore, it is requires

```typescript
export function mineSbtc(recipient: string) {
  const blockHeight = 1000;
  const burnHash = rov(sbtcDeposit.getBurnHeader(blockHeight));
  if (burnHash === null) {
    return;
  }

  txOk(
    sbtcDeposit.completeDepositWrapper(
      hexToBytes(
        '3ae3dfeedc6eb99fb5e2c5d0c90697a66de969c3f4d974ebe2ef104fcea7f13b',
      ),
      1,
      100000000, // 1 BTC
      recipient,
      burnHash,
      blockHeight,
      hexToBytes(
        '52500d11cabf1049ebb139a82b439d08bd3a8e867a41fb3f368dfa125e043989',
      ),
    ),
    'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4',
  );
}
```
