import { HardhatUserConfig } from 'hardhat/config'
import 'dotenv/config'
import '@nomicfoundation/hardhat-toolbox'
import '@nomicfoundation/hardhat-foundry'
import 'hardhat-deploy'
import 'hardhat-tracer'
import 'hardhat-abi-exporter'

const config: HardhatUserConfig = {
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
      chainId: 10226688,
      url: 'https://rpc1.testnet.yarchain.org',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    bscTestnet: {
      chainId: 97,
      url: 'https://rpc.ankr.com/bsc_testnet_chapel',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    polygonTestnet: {
      chainId: 80002,
      url: 'https://rpc.ankr.com/polygon_amoy',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    ethTestnet: {
      chainId: 11155111,
      url: 'https://rpc.ankr.com/eth_sepolia',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    optimismTestnet: {
      chainId: 11155420,
      url: 'https://rpc.ankr.com/optimism_sepolia',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    arbitrumTestnet: {
      chainId: 421614,
      url: 'https://rpc.ankr.com/arbitrum_sepolia',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    avalanceTestnet: {
      chainId: 43113,
      url: 'https://rpc.ankr.com/avalanche_fuji',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    baseTestnet: {
      chainId: 84532,
      url: 'https://rpc.ankr.com/base_sepolia',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    skaleTestnet: {
      chainId: 1444673419,
      url: 'https://testnet.skalenodes.com/v1/juicy-low-small-testnet',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    phantomTestnet: {
      chainId: 4002,
      url: 'https://rpc.ankr.com/fantom_testnet',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    mantleTestnet: {
      chainId: 5003,
      url: 'https://rpc.sepolia.mantle.xyz',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    },
    lineaTestnet: {
      chainId: 59141,
      url: 'https://rpc.sepolia.linea.build',
      accounts: [process.env.DEPLOYER!, process.env.RELAYER!],
    }
  },
}

export default config