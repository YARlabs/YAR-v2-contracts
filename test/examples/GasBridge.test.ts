import { assert, expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import {
  YarRequest,
  YarRequest__factory,
  YarResponse,
  YarResponse__factory,
} from '../../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { BigNumberish } from 'ethers'
import { YarLib } from '../../typechain-types/contracts/YarRequest'

describe('GasBridge', function () {
  let deployer: SignerWithAddress
  let oracle: SignerWithAddress
  let relayer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let yarRequest: YarRequest
  let yarResponse: YarResponse
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

    yarRequest = YarRequest__factory.connect(
      (await deployments.get('YarRequest')).address,
      ethers.provider,
    )
    yarResponse = YarResponse__factory.connect(
      (await deployments.get('YarResponse')).address,
      ethers.provider,
    )

    chainId = (await ethers.provider.getNetwork()).chainId
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [initSnapshot])
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  it('User self native token to other user', async () => {
    // ---  Step 1 ---
    // Create yarTX object
    const yarTX: YarLib.YarTXStruct = {
      initialChainId: chainId,
      sender: user.address,
      app: user.address,
      targetChainId: chainId,
      target: user2.address,
      value: ethers.parseEther('0.5'),
      data: '0x',
      depositToYarAmount: 5n, // TODO: RENAME
    }

    // --- Step 2 ---
    // Send send request
    const relayerBalanceBefore = await ethers.provider.getBalance(relayer.address)

    await expect(
      yarRequest
        .connect(user)
        .send(yarTX, { value: yarTX.depositToYarAmount }),
    )
      .to.be.emit(yarRequest, 'Send')
      .withArgs(Object.values(yarTX))

    const relayerBalanceAfter = await ethers.provider.getBalance(relayer.address)
    assert(
      relayerBalanceAfter == relayerBalanceBefore + BigInt(yarTX.depositToYarAmount),
      'connector not received fees',
    )

    // --- Step 3 ---
    // Execute crossCala request
    const targetBalanceBefore = await ethers.provider.getBalance(yarTX.target)

    await yarResponse.connect(relayer).onCrossCall(yarTX, { value: yarTX.value })

    const targetBalanceAfter = await ethers.provider.getBalance(yarTX.target)
    assert(
      targetBalanceAfter == targetBalanceBefore + BigInt(yarTX.value),
      'target not received value',
    )
  })
})
