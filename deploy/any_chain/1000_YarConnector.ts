import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get, getOrNull } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const relayer = signers[1]
  const feeOracle = signers[2]

  const alreadyDeployed = (await getOrNull('YarConnector')) != null
  if (alreadyDeployed) return

  const YarForwarderDeployments = await get('YarForwarder')

  const deployment = await deploy('YarConnector', {
    contract: 'YarConnector',
    from: deployer.address,
    args: [YarForwarderDeployments.address, relayer.address, feeOracle.address, ethers.ZeroAddress],
  })
}

deploy.tags = ['any_chain', 'YarConnector']
deploy.dependencies = ['YarForwader']
export default deploy
