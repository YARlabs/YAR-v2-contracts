import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get, getOrNull } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const relayer = signers[1]

  const alreadyDeployed = (await getOrNull('MockERC1155')) != null
  if (alreadyDeployed) return

  await deploy('MockERC1155', {
    contract: 'MockERC1155',
    from: deployer.address,
    args: [],
  })
}

deploy.tags = ['mock', 'MockERC1155']
deploy.dependencies = ['YarBridge1155Mock']
export default deploy
