import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import DEPLOY_CONFIGS from '../deploy_configs.json'

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get } = deployments

  if (!process.env.IS_PROXY_CHAIN) return

  const signers = await ethers.getSigners()
  const deployer = signers[0]
  console.log(`DEPLOY_CONFIGS.owner ${DEPLOY_CONFIGS.owner}`)
  console.log({
    gasFeesMultiplier: ethers.utils.parseUnits('1.5', 18), // x1.5
    bridgeFeesUSD: ethers.utils.parseUnits('5', 18), // 5$
  })

  const deployment = await deploy('BridgesConfig', {
    contract: 'BridgesConfig',
    from: deployer.address,
    proxy: {
      proxyContract: 'UUPS',
      execute: {
        init: {
          methodName: 'initialize',
          args: [
            [
              {
                chainId: 10226688,
                defaultRpcUrl: '',
              },
              {
                chainId: 80001,
                defaultRpcUrl: '',
              },
              {
                chainId: 97,
                defaultRpcUrl: '',
              },
              {
                chainId: 5,
                defaultRpcUrl: '',
              },
            ], //_chains
            { owner: DEPLOY_CONFIGS.owner }, //_admins
            {
              gasFeesMultiplier: ethers.utils.parseUnits('1.5', 18), // x1.5
              bridgeFeesUSD: ethers.utils.parseUnits('5', 18), // 5$
            }, //_fees
            {
              agregationServiceUrl: '',
              deployServiceUrl: '',
            }, // _meta
          ],
        },
      },
    },
  })
}

deploy.tags = ['BridgesConfig']
export default deploy
