import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get, getOrNull } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const relayer = signers[1]

  const alreadyDeployed = (await getOrNull('MockERC721')) != null
  if (alreadyDeployed) return

  await deploy('MockERC721', {
    contract: 'MockERC721',
    from: deployer.address,
    args: [
      "YAR NFT",
      "YARNFT"
    ],
  })
}

deploy.tags = ['mock', 'MockERC721']
deploy.dependencies = ['YarBridge721Mock']
export default deploy
