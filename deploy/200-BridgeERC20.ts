import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'


const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]

  const AddressBookDeployment = await get('AddressBook')

  
  const deployment = await deploy('BridgeERC20', {
    contract: 'BridgeERC20',
    from: deployer.address,
    proxy: {
      proxyContract: 'UUPS',
      execute: {
        init: {
          methodName: 'initialize',
          args: [
            AddressBookDeployment.address, // _addressBook
            process.env.IS_PROXY_CHAIN, // _isProxyChain,
            process.env.NATIVE_NAME, // _nativeName
            process.env.NATIVE_SYMBOL, // _nativeSymbol
            process.env.NATIVE_DECIMALS, // _nativeDecimals
            process.env.NATIVE_TRANSFER_GAS_LIMIT, // _nativeTransferGasLimit
          ],
        },
      },
    },
  })
}

deploy.tags = ['BridgeERC20']
deploy.dependencies = ['AddressBook']
export default deploy
