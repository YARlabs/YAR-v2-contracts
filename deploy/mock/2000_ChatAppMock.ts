import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get, getOrNull } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const relayer = signers[1]
  const feeOracle = signers[2]

  const alreadyDeployed = (await getOrNull('ChatAppMock')) != null
  if (alreadyDeployed) return

  const YarConnectorDeployments = await get('YarConnector')

  const deployment = await deploy('ChatAppMock', {
    contract: 'ChatAppMock',
    from: deployer.address,
    args: [YarConnectorDeployments.address],
  })
}

deploy.tags = ['mock', 'ChatAppMock']
deploy.dependencies = ['QuizGameMock', 'YarConnector']
export default deploy
