import { defineChain } from "viem";
import * as chains from "viem/chains";

export type ScaffoldConfig = {
  targetNetworks: readonly chains.Chain[];
  pollingInterval: number;
  alchemyApiKey: string;
  walletConnectProjectId: string;
  onlyLocalBurnerWallet: boolean;
  walletAutoConnect: boolean;
};



const scaffoldConfig = {
  // The networks on which your DApp is live
  targetNetworks: [
    defineChain({
      id: 10226688,
      name: 'YarTestnet',
      nativeCurrency: {
        decimals: 18,
        name: 'Yar',
        symbol: 'YAR',
      },
      network: '',
      rpcUrls: {
        default: {http: ['https://rpc1.testnet.yarchain.org']},
        public: {http: ['https://rpc1.testnet.yarchain.org']},
      },
    }),
    defineChain({
      id: 97,
      name: 'BscTestnet',
      nativeCurrency: {
        decimals: 18,
        name: 'BNB',
        symbol: 'BNB',
      },
      network: '',
      rpcUrls: {
        default: {http: ['https://rpc.ankr.com/bsc_testnet_chapel']},
        public: {http: ['https://rpc.ankr.com/bsc_testnet_chapel']},
      },
    }),
    defineChain({
      id: 80002,
      name: 'PolygonTestnet',
      nativeCurrency: {
        decimals: 18,
        name: 'MATIC',
        symbol: 'MATIC',
      },
      network: '',
      rpcUrls: {
        default: {http: ['https://rpc.ankr.com/polygon_amoy']},
        public: {http: ['https://rpc.ankr.com/polygon_amoy']},
      },
    }),
    
  ],

  // The interval at which your front-end polls the RPC servers for new data
  // it has no effect if you only target the local network (default is 4000)
  pollingInterval: 30000,

  // This is ours Alchemy's default API key.
  // You can get your own at https://dashboard.alchemyapi.io
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "oKxs-03sij-U_N0iOlrSsZFr29-IqbuF",

  // This is ours WalletConnect's default project ID.
  // You can get your own at https://cloud.walletconnect.com
  // It's recommended to store it in an env variable:
  // .env.local for local testing, and in the Vercel/system env config for live apps.
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "3a8170812b534d0ff9d794f19a901d64",

  // Only show the Burner Wallet when running on hardhat network
  onlyLocalBurnerWallet: true,

  /**
   * Auto connect:
   * 1. If the user was connected into a wallet before, on page reload reconnect automatically
   * 2. If user is not connected to any wallet:  On reload, connect to burner wallet if burnerWallet.enabled is true && burnerWallet.onlyLocal is false
   */
  walletAutoConnect: true,
} as const satisfies ScaffoldConfig;

export default scaffoldConfig;
