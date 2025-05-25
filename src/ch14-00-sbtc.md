# sBTC

sBTC is a decentralized, trust-minimized two-way Bitcoin peg between Bitcoin and the Stacks
blockchain. Implemented as a SIP-010 compliant fungible token on Stacks, sBTC enables
Bitcoin holders to securely represent their BTC as tokens on the Stacks chain without relying
on a single trusted entity. This bridge allows Bitcoin to be seamlessly integrated into the Stacks
ecosystem, significantly expanding Bitcoin’s utility through programmable smart contracts
while maintaining its fundamental security properties.

Detailed information about sBTC are available at [stacks.co](https://docs.stacks.co/concepts/sbtc).

## Using sBTC

Integrating sBTC into your development is as simple as integrating any other SIP-010 fungible token. Check out the dedicated Hiro [blog](https://www.hiro.so/blog/how-to-integrate-sbtc-into-your-application) to see more examples of using sBTC in your Clarity smart contract and in your front-end application.

### Unit tests with sBTC

The following function mints sBTC to the provided address. It uses [clarigen](https://www.clarigen.dev/) types.

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
        '3ae3dfeedc6eb99fb5e2c5d0c90697a66de969c3f4d974ebe2ef104fcea7f13b'
      ),
      1,
      100000000, // 1 BTC
      recipient,
      burnHash,
      blockHeight,
      hexToBytes(
        '52500d11cabf1049ebb139a82b439d08bd3a8e867a41fb3f368dfa125e043989'
      )
    ),
    'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4'
  );
}
```

For further support in testing sBTC in your local Clarity development, check out the dedicated Hiro [docs](https://docs.hiro.so/stacks/clarinet/guides/working-with-sbtc) and [learn](https://www.hiro.so/blog/expanded-sbtc-testing-support-is-live-in-clarinet-and-the-hiro-platform) how you get use the sBTC faucet in the Hiro [Platform](https://platform.hiro.so).
