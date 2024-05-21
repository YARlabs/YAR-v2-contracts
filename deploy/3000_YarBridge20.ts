import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get, getOrNull } = deployments
console.log('aw1')
  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const relayer = signers[1]
  
console.log('aw12')
  const YarRequestDeployments = await get('YarRequest')
  const YarResponseDeployments = await get('YarResponse')

  console.log('aw13')
  const alreadyDeployed = (await getOrNull('YarBridge20')) != null
  if (alreadyDeployed) return

  console.log('aw14')
  await deploy('YarBridge20', {
    contract: 'YarBridge20',
    from: deployer.address,
    args: [
      'Yar',
      'YAR',
      18,
      YarRequestDeployments.address,
      YarResponseDeployments.address
    ],
  })
  console.log('aw15')
}

deploy.tags = ['any_chain', 'YarBridge20']
deploy.dependencies = ['YarResponse']
export default deploy
