import { assert, expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import {
  YarConnector,
  YarConnector__factory,
} from '../../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { BigNumberish } from 'ethers'

describe('GasBridge', function () {
  let deployer: SignerWithAddress
  let oracle: SignerWithAddress
  let relayer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let yarConnector: YarConnector
  let yarConnectorAddress: string
  let chainId: BigNumberish

  let initSnapshot: string

  before(async () => {
    await deployments.fixture()
    const signers = await ethers.getSigners()
    deployer = signers[0]
    relayer = signers[1]
    oracle = signers[2]
    user = signers[3]
    user2 = signers[4]

    yarConnector = YarConnector__factory.connect(
      (await deployments.get('YarConnector')).address,
      ethers.provider,
    )
    yarConnectorAddress = await yarConnector.getAddress()

    chainId = (await ethers.provider.getNetwork()).chainId
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [initSnapshot])
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  it('User self native token to other user', async () => {
    // ---  Step 1 ---
    // Create crossCallData object
    const crossCallData: YarConnector.CrossCallDataStruct = {
      initialChainId: chainId,
      sender: user.address,
      app: user.address,
      targetChainId: chainId,
      target: user2.address,
      value: ethers.parseEther('0.5'),
      data: '0x',
      feeAmount: 5n,
    }

    // --- Step 2 ---
    // Send crossCall request
    const connectorBalanceBefore = await ethers.provider.getBalance(yarConnectorAddress)

    await expect(
      yarConnector.connect(user).crossCall(crossCallData, { value: crossCallData.feeAmount }),
    )
      .to.be.emit(yarConnector, 'CrossCall')
      .withArgs(Object.values(crossCallData))

    const connectorBalanceAfter = await ethers.provider.getBalance(yarConnectorAddress)
    assert(connectorBalanceAfter == connectorBalanceBefore + BigInt(crossCallData.feeAmount), 'connector not received fees')

    // --- Step 3 ---
    // Execute crossCala request
    const targetBalanceBefore = await ethers.provider.getBalance(crossCallData.target)

    await yarConnector.connect(relayer).onCrossCall(crossCallData, { value: crossCallData.value })

    const targetBalanceAfter = await ethers.provider.getBalance(crossCallData.target)
    assert(targetBalanceAfter == targetBalanceBefore + BigInt(crossCallData.value), 'target not received value')
  })
})
