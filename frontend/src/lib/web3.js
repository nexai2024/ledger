// Real Base mainnet USDC payment via injected EIP-1193 wallet (MetaMask / Coinbase Wallet)
const BASE_CHAIN_ID_HEX = "0x2105"; // 8453

function toHex(n) {
  return "0x" + BigInt(n).toString(16);
}

// Pad a hex string (no 0x) to 32 bytes
function pad32(hexNo0x) {
  return hexNo0x.padStart(64, "0");
}

export function hasWallet() {
  return typeof window !== "undefined" && !!window.ethereum;
}

export async function connectWallet() {
  if (!hasWallet()) throw new Error("No Web3 wallet found. Install MetaMask or Coinbase Wallet.");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  await ensureBaseNetwork();
  return accounts[0];
}

export async function ensureBaseNetwork() {
  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (current === BASE_CHAIN_ID_HEX) return;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: BASE_CHAIN_ID_HEX,
          chainName: "Base",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://mainnet.base.org"],
          blockExplorerUrls: ["https://basescan.org"],
        }],
      });
    } else {
      throw e;
    }
  }
}

// Build ERC20 transfer(address,uint256) calldata and send from connected wallet
export async function payUsdc({ usdcContract, to, amountUsdc, decimals = 6, from }) {
  const amountUnits = BigInt(Math.round(Number(amountUsdc) * 10 ** decimals));
  const selector = "a9059cbb";
  const addrParam = pad32(to.toLowerCase().replace("0x", ""));
  const amountParam = pad32(amountUnits.toString(16));
  const data = "0x" + selector + addrParam + amountParam;

  const txHash = await window.ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from, to: usdcContract, data, value: "0x0" }],
  });
  return txHash;
}
