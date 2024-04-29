import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const relayer = signers[1]


  const deployment = await deploy('Multicall3', {
    contract: 'Multicall3',
    from: deployer.address
  })
}

deploy.tags = ['only_yar_chain','Multicall3']
deploy.dependencies = ['YarHub']
export default deploy
