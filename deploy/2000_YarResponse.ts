import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, getOrNull } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const relayer = signers[1]

  const alreadyDeployed = (await getOrNull('YarResponse')) != null
  if (alreadyDeployed) return

  await deploy('YarResponse', {
    contract: 'YarResponse',
    from: deployer.address,
    args: [relayer.address],
  })
}

deploy.tags = ['any_chain', 'YarResponse']
deploy.dependencies = ['YarRequest']
export default deploy
