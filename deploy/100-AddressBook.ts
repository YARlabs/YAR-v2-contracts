import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import DEPLOY_CONFIGS from '../deploy_configs.json'


const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { ethers, deployments } = hre
  const { deploy, get } = deployments

  const signers = await ethers.getSigners()
  const deployer = signers[0]

  const TransferValidatorDeployment = await get('TransferValidator')

  
  const deployment = await deploy('AddressBook', {
    contract: 'AddressBook',
    from: deployer.address,
    proxy: {
      proxyContract: 'UUPS',
      execute: {
        init: {
          methodName: 'initialize',
          args: [
            {
              owner: DEPLOY_CONFIGS.owner,
              transferApprover: DEPLOY_CONFIGS.transferApprover,
              transferValidator: TransferValidatorDeployment.address,
            }, // admins
            process.env.FEE_TOKEN ?? ethers.constants.AddressZero, // feeToken
          ],
        },
      },
    },
  })
}

deploy.tags = ['AddressBook']
deploy.dependencies = ['TransferValidator']
export default deploy
