import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import DEPLOY_CONFIGS from '../deploy_configs.json'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]

  const deployment = await deploy('TransferValidator', {
    contract: 'MultisigWallet',
    from: deployer.address,
    args: [
      DEPLOY_CONFIGS.transferValidatorRequiredSigners,
      DEPLOY_CONFIGS.transferValidatorSigners
    ],
  })
}

deploy.tags = ['TransferValidator']
export default deploy
