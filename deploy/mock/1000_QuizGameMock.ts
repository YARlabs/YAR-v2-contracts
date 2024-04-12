import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get, getOrNull } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const relayer = signers[1]
  const feeOracle = signers[2]

  const alreadyDeployed = (await getOrNull('QuizGameMock')) != null
  if (alreadyDeployed) return


  const deployment = await deploy('QuizGameMock', {
    contract: 'QuizGameMock',
    from: deployer.address,
    args: [
      ethers.solidityPackedKeccak256(['string'], ['true answer']),
      ethers.parseEther('1')
    ],
    value: ethers.parseEther('1').toString()
  })
}

deploy.tags = ['mock', 'QuizGameMock']
export default deploy
