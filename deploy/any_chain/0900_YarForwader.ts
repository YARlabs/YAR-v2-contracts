import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get, getOrNull } = deployments

  const alreadyDeployed = (await getOrNull('YarForwarder')) != null
  if (alreadyDeployed) return

  const signers = await ethers.getSigners()
  const deployer = signers[0]

  const deployment = await deploy('YarForwarder', {
    contract: 'YarForwarder',
    from: deployer.address,
  })
}

deploy.tags = ['any_chain', 'YarForwarder']
export default deploy
