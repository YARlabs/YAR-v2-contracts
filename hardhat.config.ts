import { HardhatUserConfig } from 'hardhat/config'
import 'dotenv/config'
import '@nomicfoundation/hardhat-toolbox'
import '@nomicfoundation/hardhat-foundry'
import 'hardhat-deploy'
import 'hardhat-tracer'
import 'hardhat-abi-exporter'

const config: HardhatUserConfig | any = {
  solidity: {
    compilers: [
      {
        version: '0.8.20',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    ],
  },
  networks: {
    hardhat: {
      tokenName: "HH",
      tokenSymbol: "HH",
      chainId: 31337,
      // mining: {
      //   auto: false,
      //   interval: 5000,
      // },
      forking: {
        url: 'https://rpc.ankr.com/eth',
        blockNumber: 19712863
      },
      blockGasLimit: 30000000,
      accounts: {
        count: 10,
        accountsBalance: '100000000000000000000000000000',
      },
      loggingEnabled: true,
      // loggingEnabled: false,
    },
    yarTestnet: {
      tokenName: "YAR chain",
      tokenSymbol: "YAR",
      peerSymbol: "YAR",
      chainId: 10226688,
      url: 'https://rpc1.testnet.yarchain.org',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    bscTestnet: {
      tokenName: "Binance smart chain",
      tokenSymbol: "BNB",
      peerSymbol: "BSC",
      chainId: 97,
      url: 'https://rpc.ankr.com/bsc_testnet_chapel',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    polygonTestnet: {
      tokenName: "Polygon",
      tokenSymbol: "POL",
      peerSymbol: "POL",
      chainId: 80002,
      url: 'https://rpc.ankr.com/polygon_amoy',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    ethTestnet: {
      tokenName: "Ethereum",
      tokenSymbol: "ETH",
      peerSymbol: "ETH",
      chainId: 11155111,
      url: 'https://rpc.ankr.com/eth_sepolia',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    optimismTestnet: {
      tokenName: "Optimism",
      tokenSymbol: "ETH",
      peerSymbol: "OP",
      chainId: 11155420,
      url: 'https://rpc.ankr.com/optimism_sepolia',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    arbitrumTestnet: {
      tokenName: "Arbitrum",
      tokenSymbol: "ETH",
      peerSymbol: "ARB",
      chainId: 421614,
      url: 'https://rpc.ankr.com/arbitrum_sepolia',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    avalanceTestnet: {
      tokenName: "Avalance",
      tokenSymbol: "AVAX",
      peerSymbol: "AVAX",
      chainId: 43113,
      url: 'https://rpc.ankr.com/avalanche_fuji',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    baseTestnet: {
      tokenName: "BASE",
      tokenSymbol: "sFUEL",
      peerSymbol: "BASE",
      chainId: 84532,
      url: 'https://rpc.ankr.com/base_sepolia',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    skaleTestnet: {
      tokenName: "SKALE",
      tokenSymbol: "SKL",
      peerSymbol: "SKL",
      chainId: 1444673419,
      url: 'https://testnet.skalenodes.com/v1/juicy-low-small-testnet',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    phantomTestnet: {
      tokenName: "Fantom",
      tokenSymbol: "FTM",
      peerSymbol: "FTM",
      chainId: 4002,
      url: 'https://rpc.testnet.fantom.network',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    mantleTestnet: {
      tokenName: "Mantle",
      tokenSymbol: "MNT",
      peerSymbol: "MNT",
      chainId: 5003,
      url: 'https://rpc.sepolia.mantle.xyz',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    lineaTestnet: {
      tokenName: "Linea",
      tokenSymbol: "ETH",
      peerSymbol: "LINEA",
      chainId: 59141,
      url: 'https://rpc.sepolia.linea.build',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    xdcTestnet: {
      tokenName: "XDC",
      tokenSymbol: "XDC",
      peerSymbol: "XDC",
      chainId: 51,
      url: 'https://erpc.apothem.network',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    }
  },
}

export default config