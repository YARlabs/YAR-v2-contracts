import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get, getOrNull } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const relayer = signers[1]

  const alreadyDeployed = (await getOrNull('YarRequest')) != null
  if (alreadyDeployed) return

  // const YarMetaForwarderDeployments = await get('YarMetaForwarder')

  const deployment = await deploy('YarRequest', {
    contract: 'YarRequest',
    deterministicDeployment: ethers.encodeBytes32String('YarRequest'),
    from: deployer.address,
    args: [
      // YarMetaForwarderDeployments.address, 
      relayer.address, 
      ethers.ZeroAddress
    ],
  })
}

deploy.tags = ['any_chain', 'YarRequest']
// deploy.dependencies = ['YarMetaForwarder']
export default deploy
