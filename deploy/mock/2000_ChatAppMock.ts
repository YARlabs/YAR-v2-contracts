import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get, getOrNull } = deployments

  return

  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const relayer = signers[1]
  const feeOracle = signers[2]

  const alreadyDeployed = (await getOrNull('ChatAppMock')) != null
  if (alreadyDeployed) return

  const YarRequestDeployments = await get('YarRequest')
  const YarResponseDeployments = await get('YarResponse')

  const deployment = await deploy('ChatAppMock', {
    contract: 'ChatAppMock',
    from: deployer.address,
    args: [YarRequestDeployments.address, YarResponseDeployments.address],
  })
}

deploy.tags = ['mock', 'ChatAppMock']
// deploy.dependencies = ['QuizGameMock', 'YarRequest', 'YarResponse']
export default deploy
