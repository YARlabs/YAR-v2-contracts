import { assert, expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import {
  QuizGameMock,
  QuizGameMock__factory,
  YarRequest,
  YarRequest__factory,
  YarResponse,
  YarResponse__factory,
} from '../../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { BigNumberish } from 'ethers'
import { YarLib } from '../../typechain-types/contracts/YarRequest'

describe('QuizGame', function () {
  let deployer: SignerWithAddress
  let oracle: SignerWithAddress
  let relayer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let yarRequest: YarRequest
  let yarResponse: YarResponse
  let quizGameMock: QuizGameMock
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

    quizGameMock = QuizGameMock__factory.connect(
      (await deployments.get('QuizGameMock')).address,
      ethers.provider,
    )

    chainId = (await ethers.provider.getNetwork()).chainId
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [initSnapshot])
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  it('Example', async () => {
    // --- Step 1 ---
    // Create yarTX object
    const yarTX: YarLib.YarTXStruct = {
      initialChainId: chainId,
      sender: user.address,
      app: user.address,
      targetChainId: chainId,
      target: await quizGameMock.getAddress(),
      value: await quizGameMock.fee(),
      data: quizGameMock.interface.encodeFunctionData('sendAnswer', [user.address, 'true answer']),
      depositToYarAmount: 5n,
    }

    // --- Step 2 ---
    // Send send request
    const relayerBalanceBefore = await ethers.provider.getBalance(relayer.address)

    await expect(
      yarRequest.connect(user).send(yarTX, { value: yarTX.depositToYarAmount }),
    )
      .to.be.emit(yarRequest, 'Send')
      .withArgs(Object.values(yarTX))

    const relayerBalanceAfter = await ethers.provider.getBalance(relayer.address)
    assert(
      relayerBalanceAfter == relayerBalanceBefore + BigInt(yarTX.depositToYarAmount),
      'connector not received fees',
    )

    // --- Step 3 ---
    // Execute send request
    const userBalanceBefore = await ethers.provider.getBalance(user.address)
    const targetBalanceBefore = await ethers.provider.getBalance(yarTX.target)

    await yarResponse.connect(relayer).onCrossCall(yarTX, { value: yarTX.value })

    const userBalanceAfter = await ethers.provider.getBalance(user.address)
    const targetBalanceAfter = await ethers.provider.getBalance(yarTX.target)

    assert(
      userBalanceAfter == userBalanceBefore + (await quizGameMock.rewards()),
      'user not recived quiz rewards!',
    )
    assert(
      targetBalanceAfter ==
        targetBalanceBefore + BigInt(yarTX.value) - (await quizGameMock.rewards()),
      'quiz game not recived fees!',
    )
  })
})
