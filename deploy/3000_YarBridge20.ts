import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments, config, network } = hre
  const { deploy, get, getOrNull } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]
  const relayer = signers[1]

  const YarRequestDeployments = await get('YarRequest')
  const YarResponseDeployments = await get('YarResponse')

  const alreadyDeployed = (await getOrNull('YarBridge20')) != null
  if (alreadyDeployed) return;

  const tokenName = (config.networks[network.name] as any)?.tokenName || "YAR";
  const tokenSymbol = (config.networks[network.name] as any)?.tokenSymbol || "YAR";

  console.log("Deploy bridge erc20", tokenName, tokenSymbol);

  await deploy('YarBridge20', {
    contract: 'YarBridge20',
    from: deployer.address,
    args: [
      tokenName,
      tokenSymbol,
      18,
      YarRequestDeployments.address,
      YarResponseDeployments.address
    ],
  })
}

deploy.tags = ['any_chain', 'YarBridge20']
deploy.dependencies = ['YarResponse']
export default deploy
