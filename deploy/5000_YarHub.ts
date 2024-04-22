import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const relayer = signers[1]


  const deployment = await deploy('YarHub', {
    contract: 'YarHub',
    deterministicDeployment: ethers.encodeBytes32String('YarHub'),
    from: deployer.address,
    args: [
      relayer.address
    ]
  })
}

deploy.tags = ['only_yar_chain','YarHub']
deploy.dependencies = ['YarBridge20']
export default deploy
