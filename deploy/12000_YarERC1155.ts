import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get, getOrNull } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const relayer = signers[1]

  const alreadyDeployed = (await getOrNull('YarERC1155')) != null
  if (alreadyDeployed) return

  await deploy('YarERC1155', {
    contract: 'YarERC1155',
    from: deployer.address,
    args: [],
  })
}

deploy.tags = ['any_chain', 'YarERC1155']
deploy.dependencies = ['YarBridge1155']
export default deploy
