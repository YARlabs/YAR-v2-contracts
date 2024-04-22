import { HardhatUserConfig } from 'hardhat/config'
import 'dotenv/config'
import '@nomicfoundation/hardhat-toolbox'
import '@nomicfoundation/hardhat-foundry'
import 'hardhat-deploy'
import 'hardhat-tracer'

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
  },
}

export default config