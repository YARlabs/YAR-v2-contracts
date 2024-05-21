import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get, getOrNull } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const relayer = signers[1]

  const YarRequestDeployments = await get('YarRequest')
  const YarResponseDeployments = await get('YarResponse')

  const alreadyDeployed = (await getOrNull('YarBridge1155Mock')) != null
  if (alreadyDeployed) return

  await deploy('YarBridge1155Mock', {
    contract: 'YarBridge1155Mock',
    from: deployer.address,
    args: [
      YarRequestDeployments.address,
      YarResponseDeployments.address
    ],
  })
}

deploy.tags = ['mock', 'YarBridge1155Mock']
deploy.dependencies = ['YarBridge1155']
export default deploy
