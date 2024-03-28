import { HardhatUserConfig, task } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import '@openzeppelin/hardhat-upgrades'
import '@nomiclabs/hardhat-etherscan'
import 'hardhat-deploy'
import 'hardhat-gas-reporter'
import 'hardhat-tracer'
import 'hardhat-abi-exporter'
import '@nomicfoundation/hardhat-chai-matchers'
import 'hardhat-contract-sizer'


const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.18',
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
      forking: {
        url: 'https://mainnet.infura.io/v3/32c869b2294046f4931f3d8b93b2dae0',
      },
      // mining: {
      //   auto: false,
      //   interval: 5000,
      // },
      blockGasLimit: 30000000,
      accounts: {
        count: 10,
        accountsBalance: '1000000000000000000000000000',
      },
      loggingEnabled: true,
      // loggingEnabled: false,
    },
    // yarTest: {
    //   url: 'https://rpc1.testnet.yarchain.org',
    //   accounts: [pk],
    // },
    // polygonTest: {
    //   url: 'https://rpc.ankr.com/polygon_mumbai',
    //   accounts: [pk],
    // },
    // binanceTest: {
    //   url: "https://data-seed-prebsc-1-s1.binance.org:8545",
    //   accounts: [pk],
    // },
    // arbitrumTest: {
    //   url: 'https://arbitrum-goerli.publicnode.com',
    //   accounts: [pk],
    // },
  },
  abiExporter: {
    path: './abi',
  },
  gasReporter: {
    enabled: true,
    currency: 'USD',
    gasPrice: 30,
  },
  mocha: {
    timeout: 100000000,
  },
}

export default config
