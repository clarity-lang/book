let contractDeployed = 0;

let deployer = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
let wallet_1 = "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5";
let wallet_2 = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";
let wallet_3 = "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC";
let wallets = [deployer, wallet_1, wallet_2, wallet_3];

let deployed = false;

// quick fix for the globalThis.window issue
// the clarinet sdk expects a window object, which doesn't exists in the context of a web worker
// the sdk should instead rely on globalThis - this will be fixed in a future version
// @ts-ignore
globalThis.window = globalThis;

/** @import { Simnet } from "@hirosystems/clarinet-sdk-browser" */
/** @import { InitOptions } from "./simnet" */

/** @type {Simnet | null} */
let simnet = null;

/**
 * @typedef SimnetWorkerMessage
 * @property {string} action
 * @property {any} data
 */

/**
 * @param {MessageEvent<SimnetWorkerMessage>} e
 */
onmessage = (e) => {
  const { action, data } = e.data;
  if (action === "init") {
    initClarinetSDK(data);
  } else if (action === "deployContract") {
    deployContract(data.content, data.id);
  } else if (action === "executeCommand") {
    executeCommand(data.command, data.id);
  } else {
    console.warn("invalid event", e);
  }
};

/**
 * @param {string} output
 * @param {string[]} classes
 */
function postOutput(output, id, classes) {
  postMessage({
    action: "appendOutput",
    data: {
      output,
      id,
      classes,
    },
  });
}

/**
 * @param {any} value
 * @param {string[]} classes
 */
function postClarityResult(value, events, id, classes) {
  postMessage({
    action: "appendClarityResult",
    data: {
      value,
      classes,
      events,
      id,
    },
  });
}

/**
 * @param {InitOptions} options
 */
export async function initClarinetSDK(options) {
  const { initSimnet, SDK } = await import(
    // @ts-ignore
    "https://esm.sh/@hirosystems/clarinet-sdk-browser@latest"
  );

  // init simnet
  simnet = /** @type {Simnet} */ (await initSimnet());
  await simnet.initEmptySession({
    enabled: options.remoteData,
    initial_height: options.initialHeight,
    api_url: "https://api.hiro.so",
  });

  simnet.setLocalAccounts(wallets);
  wallets.forEach((address) => {
    // @ts-ignore
    simnet.mintSTX(address, 1000000000n);
  });

  simnet.executeCommand(`::set_tx_sender ${deployer}`);
  if (!options.remoteData) {
    // the EpochString type isn't exported atm
    // @ts-ignore
    simnet.setEpoch(options.epoch || SDK.getDefaultEpoch());
  }

  const currentEpoch = simnet.currentEpoch;
  postMessage({
    action: "initialized",
    data: {
      currentEpoch,
    },
  });
}

/**
 * @arg {string} command
 */
function executeCommand(command, id) {
  if (!simnet) return;

  try {
    if (command.startsWith("::")) {
      const result = simnet.executeCommand(command);

      if (
        command.startsWith("::set_epoch") &&
        result.startsWith("Epoch updated to")
      ) {
        postMessage({
          action: "setEpoch",
          data: {
            newEpoch: simnet.currentEpoch,
          },
        });
      }

      postOutput(result, id, ["log"]);
      return;
    }
    let { result, events } = simnet.execute(command);
    postClarityResult(result, events, id, ["success"]);
  } catch (e) {
    console.log("error executing command", e);
    if (typeof e === "string") {
      postOutput(e, id, ["error"]);
    } else {
      console.warn("error", e);
    }
  }
}

/**
 * @param {string} content
 * @returns {boolean}
 */
export function deployContract(content, id) {
  if (!simnet) return false;
  if (deployed) {
    postOutput("contract already deployed", id, ["log"]);
    return false;
  }

  const contractName = `contract-${contractDeployed}`;
  const clarityVersionString = simnet.getDefaultClarityVersionForCurrentEpoch();
  const clarityVersion = parseInt(clarityVersionString.replace("Clarity ", ""));

  try {
    const { result } = simnet.deployContract(
      contractName,
      content,
      // @ts-ignore
      { clarityVersion },
      deployer
    );

    postOutput(`contract deployed: .${contractName}`, id, ["log"]);
    postClarityResult(result, [], id, ["success"]);
    contractDeployed++;
  } catch (e) {
    if (typeof e === "string") {
      postOutput(e, id, ["error"]);
    }
  }
  postMessage({
    action: "setDeployedStatus",
    data: {
      newStatus: true,
    },
  });
  return true;
}
