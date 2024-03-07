import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { EthersUtils } from '../../utils/EthersUtils'


const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get } = deployments

  const signers = await ethers.getSigners()
  const validator = signers[0]

  const currentChain = EthersUtils.keccak256('YAR')
  const isProxyChain = true

  const nativeName = 'Yar Token'
  const nativeSymbol = 'YAR'
  const nativeDecimals = 18
  const nativeTransferGasLimit = 35000

  const IssuedERC20Deployment = await get('IssuedERC20')

  const deployment = await deploy('YarBridgeERC20', {
    contract: 'BridgeERC20',
    from: validator.address,
    args: [
      currentChain, // _currentChain,
      isProxyChain, // _isProxyChain,
      IssuedERC20Deployment.address, // _issuedTokenImplementation,
      validator.address, // _validator
      nativeName, // _nativeName
      nativeSymbol, // _nativeSymbol
      nativeDecimals, // _nativeDecimals
      nativeTransferGasLimit, // _nativeTransferGasLimit
    ],
  })
}

deploy.tags = ['YarBridge', 'YarBridgeERC20']
deploy.dependencies = ['IssuedERC20']
export default deploy
