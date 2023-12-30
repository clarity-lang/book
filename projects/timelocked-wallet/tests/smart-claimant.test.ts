import { Cl } from '@stacks/transactions';
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const beneficiary = simnet.deployer + ".smart-claimant";
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get('wallet_3')!;
const wallet4 = accounts.get("wallet_4")!;
const wallet5 = accounts.get('wallet_5')!;
const targetBlockHeight = 10;
const amount = 1000; // be sure to pick a test amount that is divisible by 4 for this test.
const share = Math.floor(amount / 4);

describe('test `Disburse_claim` public function', () => {
    it('Disburses tokens once it can claim the time-locked wallet balance', () => {
        simnet.callPublicFn('timelocked-wallet', 'lock', [Cl.principal(beneficiary), Cl.uint(targetBlockHeight), Cl.uint(amount)], deployer);
        
        simnet.mineEmptyBlocks(targetBlockHeight);

        const receipt = simnet.callPublicFn('smart-claimant', 'claim', [], deployer);

        expect(receipt.result).toBeOk(Cl.bool(true));


        // All wallets should have received their share.
        expect(receipt.events).toHaveLength(5);
        expect(receipt.events[0].event).toBe('stx_transfer_event');
        expect(receipt.events[1].event).toBe('stx_transfer_event');
        expect(receipt.events[2].event).toBe('stx_transfer_event');
        expect(receipt.events[3].event).toBe('stx_transfer_event');
        expect(receipt.events[4].event).toBe('stx_transfer_event');

        expect(receipt.events[0].data).toMatchObject({
            amount: "1000",
            sender: deployer + ".timelocked-wallet",
            recipient: beneficiary,
          });

          expect(receipt.events[1].data).toMatchObject({
            amount: "250",
            sender: deployer + ".smart-claimant",
            recipient: wallet1,
          });

          expect(receipt.events[2].data).toMatchObject({
            amount: "250",
            sender: deployer + ".smart-claimant",
            recipient: wallet2,
          });

          expect(receipt.events[3].data).toMatchObject({
            amount: "250",
            sender: deployer + ".smart-claimant",
            recipient: wallet3,
          });

          expect(receipt.events[4].data).toMatchObject({
            amount: "250",
            sender: deployer + ".smart-claimant",
            recipient: wallet4,
          });
    });
  });