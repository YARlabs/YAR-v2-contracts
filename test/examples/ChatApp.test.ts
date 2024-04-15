import { assert, expect, use } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import {
  ChatAppMock,
  ChatAppMock__factory,
  YarRequest,
  YarRequest__factory,
  YarResponse,
  YarResponse__factory,
} from '../../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { BigNumberish } from 'ethers'
import { YarLib } from '../../typechain-types/contracts/YarRequest'

describe('ChatApp', function () {
  let deployer: SignerWithAddress
  let oracle: SignerWithAddress
  let relayer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let yarRequest: YarRequest
  let yarResponse: YarResponse
  let chatAppMock: ChatAppMock
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

    chatAppMock = ChatAppMock__factory.connect(
      (await deployments.get('ChatAppMock')).address,
      ethers.provider,
    )

    chainId = (await ethers.provider.getNetwork()).chainId
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [initSnapshot])
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  it('Example: approve', async () => {
    // --- Step 1 ---
    // Create Message object

    const message: ChatAppMock.MessageStruct = {
      from: user.address,
      to: user2.address,
      secretMessage: '0x',
      fromSignature: '0x',
    }

    // --- Step 2 ---
    // Create yarTX object
    const yarTX: YarLib.YarTXStruct = {
      initialChainId: chainId,
      sender: user.address,
      app: await chatAppMock.getAddress(),
      targetChainId: chainId,
      target: await chatAppMock.getAddress(),
      value: 0n,
      data: chatAppMock.interface.encodeFunctionData('receiveMessage', [message]),
      depositToYarAmount: 5n,
    }

    // --- Step 3 ---
    // Send message

    await yarRequest.connect(user).approve(yarTX)

    await expect(
      chatAppMock
        .connect(user)
        .sendMessage(message, yarTX, { value: yarTX.depositToYarAmount }),
    )
      .to.emit(yarRequest, 'Send')
      .withArgs(Object.values(yarTX))

    // --- Step 4 ---
    // Execute send request

    await yarResponse.connect(relayer).onCrossCall(yarTX, { value: yarTX.value })

    assert((await chatAppMock.messagesLength(message.to)) > 0, 'message not received')
  })

  it('Example: permit', async () => {
    // --- Step 1 ---
    // Create Message object
    const message: ChatAppMock.MessageStruct = {
      from: user.address,
      to: user2.address,
      secretMessage: '0x',
      fromSignature: '0x',
    }

    // --- Step 2 ---
    // Create yarTX object
    const yarTX: YarLib.YarTXStruct = {
      initialChainId: chainId,
      sender: user.address,
      app: await chatAppMock.getAddress(),
      targetChainId: chainId,
      target: await chatAppMock.getAddress(),
      value: 0n,
      data: chatAppMock.interface.encodeFunctionData('receiveMessage', [message]),
      depositToYarAmount: 5n,
    }

    // --- Step 3 ---
    // Send message

    const signatureExpired = (await ethers.provider.getBlock('latest'))!.timestamp + 100000
    const signature = await signPermit(
      user,
      chainId,
      await yarRequest.getAddress(),
      signatureExpired,
      yarTX,
    )

    await expect(
      chatAppMock
        .connect(user)
        .sendMessagePermit(message, yarTX, signatureExpired, signature, {
          value: yarTX.depositToYarAmount,
        }),
    )
      .to.emit(yarRequest, 'Send')
      .withArgs(Object.values(yarTX))

    // --- Step 4 ---
    // Execute send request

    await yarResponse.connect(relayer).onCrossCall(yarTX, { value: yarTX.value })

    assert((await chatAppMock.messagesLength(message.to)) > 0, 'message not received')
  })

  it('Example: gateway', async () => {
    // --- Step 1 ---
    // Create Message object
    const message: ChatAppMock.MessageStruct = {
      from: user.address,
      to: user2.address,
      secretMessage: '0x',
      fromSignature: '0x',
    }

    // --- Step 2 ---
    // Create yarTX object
    const yarTX: YarLib.YarTXStruct = {
      initialChainId: chainId,
      sender: user.address,
      app: await chatAppMock.getAddress(),
      targetChainId: chainId,
      target: await chatAppMock.getAddress(),
      value: 0n,
      data: chatAppMock.interface.encodeFunctionData('receiveMessage', [message]),
      depositToYarAmount: 5n,
    }

    // --- Step 3 ---
    // Send message

    await expect(
      yarRequest
        .connect(user)
        .approveAndCallApp(
          chatAppMock.interface.encodeFunctionData('sendMessage', [message, yarTX]),
          yarTX,
          {
            value: yarTX.depositToYarAmount,
          },
        ),
    )
      .to.emit(yarRequest, 'Send')
      .withArgs(Object.values(yarTX))

    // --- Step 4 ---
    // Execute send request

    await yarResponse.connect(relayer).onCrossCall(yarTX, { value: yarTX.value })

    assert((await chatAppMock.messagesLength(message.to)) > 0, 'message not received')
  })
})

async function signPermit(
  signer: SignerWithAddress,
  chainId: BigNumberish,
  yarConnector: string,
  signatureExpired: BigNumberish,
  yarTX: YarLib.YarTXStruct,
): Promise<string> {
  const domain = {
    name: 'YarRequest',
    version: '1',
    chainId: chainId,
    verifyingContract: yarConnector,
  }
  const types = {
    Permit: [
      { name: 'nonce', type: 'uint256' },
      { name: 'signatureExpired', type: 'uint256' },
      { name: 'yarTX', type: 'YarTX' },
    ],
    YarTX: [
      { name: 'initialChainId', type: 'uint256' },
      { name: 'sender', type: 'address' },
      { name: 'app', type: 'address' },
      { name: 'targetChainId', type: 'uint256' },
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'depositToYarAmount', type: 'uint256' },
    ],
  }
  const permit = {
    nonce: 0,
    signatureExpired,
    yarTX: yarTX,
  }
  return await signer.signTypedData(domain, types, permit)
}
