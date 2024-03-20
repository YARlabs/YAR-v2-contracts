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

task('deploy_bridge', "Prints an account's balance")
  .addFlag('isproxy', '')
  .addOptionalParam('feetoken', '', '0x0000000000000000000000000000000000000000')
  .addOptionalParam('name', '', 'Ethereum')
  .addOptionalParam('symbol', '', 'ETH')
  .addOptionalParam('decimals', '', '18')
  .addOptionalParam('gaslimit', '', '35000')
  .setAction(async (taskArgs, hre) => {
    process.env.IS_PROXY_CHAIN = taskArgs.isproxy
    process.env.FEE_TOKEN = taskArgs.feetoken
    process.env.NATIVE_NAME = taskArgs.name
    process.env.NATIVE_SYMBOL = taskArgs.symbol
    process.env.NATIVE_DECIMALS = taskArgs.decimals
    process.env.NATIVE_TRANSFER_GAS_LIMIT = taskArgs.gaslimit
    await hre.run('deploy')
  })

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
      mining: {
        auto: false,
        interval: 5000,
      },
      blockGasLimit: 30000000,
      accounts: {
        count: 10,
        accountsBalance: '1000000000000000000000000000',
      },
      loggingEnabled: true,
      // loggingEnabled: false,
    },
  },
  abiExporter: {
    path: '../../packages/typechains/src/abi',
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
