import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const relayer = signers[1]

  const deployment = await deploy('YarHub', {
    contract: 'YarHub',
    from: deployer.address,
    args: [
      relayer.address
    ]
  })
}

deploy.tags = ['only_yar_chain','YarHub']
export default deploy
