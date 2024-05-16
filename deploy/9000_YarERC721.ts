import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get, getOrNull } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const relayer = signers[1]

  const alreadyDeployed = (await getOrNull('YarERC721')) != null
  if (alreadyDeployed) return

  await deploy('YarERC721', {
    contract: 'YarERC721',
    from: deployer.address,
    args: [
      "YAR NFT",
      "YARNFT"
    ],
  })
}

deploy.tags = ['any_chain', 'YarERC721']
deploy.dependencies = ['YarBridge721']
export default deploy
