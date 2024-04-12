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
      blockGasLimit: 30000000,
      accounts: {
        count: 10,
        accountsBalance: '100000000000000000000000000000'
      },
      loggingEnabled: true,
      // loggingEnabled: false,
    },
    yarTestnet: {
      chainId: 10226688,
      url: 'https://rpc1.testnet.yarchain.org',
      accounts: [
        process.env.YAR_DEPLOYER!,
        process.env.RELAYER!,
        process.env.ORACLE!,
      ]
    },
    avalancheTestnet: {
      chainId: 43113,
      url: 'https://rpc.ankr.com/avalanche_fuji',
      accounts: [
        process.env.AVALANCHE_DEPLOYER!,
        process.env.RELAYER!,
        process.env.ORACLE!,
      ]
    },
    polygonTestnet: {
      chainId: 80001,
      url: 'https://rpc.ankr.com/polygon_mumbai',
      accounts: [
        process.env.POLYGON_DEPLOYER!,
        process.env.RELAYER!,
        process.env.ORACLE!,]
    },
  },
}

export default config
