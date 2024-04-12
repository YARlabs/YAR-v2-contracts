import { assert, expect, use } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import {
  ChatAppMock,
  ChatAppMock__factory,
  YarConnector,
  YarConnector__factory,
} from '../../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { BigNumberish } from 'ethers'

describe('ChatApp', function () {
  let deployer: SignerWithAddress
  let oracle: SignerWithAddress
  let relayer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let yarConnector: YarConnector
  let yarConnectorAddress: string
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

    yarConnector = YarConnector__factory.connect(
      (await deployments.get('YarConnector')).address,
      ethers.provider,
    )
    yarConnectorAddress = await yarConnector.getAddress()

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
    // Create crossCallData object
    const crossCallData: YarConnector.CrossCallDataStruct = {
      initialChainId: chainId,
      sender: user.address,
      app: await chatAppMock.getAddress(),
      targetChainId: chainId,
      target: await chatAppMock.getAddress(),
      value: 0n,
      data: chatAppMock.interface.encodeFunctionData('receiveMessage', [message]),
      feeAmount: 5n,
    }

    // --- Step 3 ---
    // Send message

    await yarConnector.connect(user).approveCrossCall(crossCallData)

    await expect(
      chatAppMock
        .connect(user)
        .sendMessage(message, crossCallData, { value: crossCallData.feeAmount }),
    )
      .to.emit(yarConnector, 'CrossCall')
      .withArgs(Object.values(crossCallData))

    // --- Step 4 ---
    // Execute crossCall request

    await yarConnector.connect(relayer).onCrossCall(crossCallData, { value: crossCallData.value })

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
    // Create crossCallData object
    const crossCallData: YarConnector.CrossCallDataStruct = {
      initialChainId: chainId,
      sender: user.address,
      app: await chatAppMock.getAddress(),
      targetChainId: chainId,
      target: await chatAppMock.getAddress(),
      value: 0n,
      data: chatAppMock.interface.encodeFunctionData('receiveMessage', [message]),
      feeAmount: 5n,
    }

    // --- Step 3 ---
    // Send message

    const signatureExpired = (await ethers.provider.getBlock('latest'))!.timestamp + 100000
    const signature = await signPermit(
      user,
      chainId,
      await yarConnector.getAddress(),
      signatureExpired,
      crossCallData,
    )

    await expect(
      chatAppMock
        .connect(user)
        .sendMessagePermit(message, crossCallData, signatureExpired, signature, {
          value: crossCallData.feeAmount,
        }),
    )
      .to.emit(yarConnector, 'CrossCall')
      .withArgs(Object.values(crossCallData))

    // --- Step 4 ---
    // Execute crossCall request

    await yarConnector.connect(relayer).onCrossCall(crossCallData, { value: crossCallData.value })

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
    // Create crossCallData object
    const crossCallData: YarConnector.CrossCallDataStruct = {
      initialChainId: chainId,
      sender: user.address,
      app: await chatAppMock.getAddress(),
      targetChainId: chainId,
      target: await chatAppMock.getAddress(),
      value: 0n,
      data: chatAppMock.interface.encodeFunctionData('receiveMessage', [message]),
      feeAmount: 5n,
    }

    // --- Step 3 ---
    // Send message

    await expect(
      yarConnector
        .connect(user)
        .crossCallGateway(
          chatAppMock.interface.encodeFunctionData('sendMessage', [message, crossCallData]),
          crossCallData,
          {
            value: crossCallData.feeAmount,
          },
        ),
    )
      .to.emit(yarConnector, 'CrossCall')
      .withArgs(Object.values(crossCallData))

    // --- Step 4 ---
    // Execute crossCall request

    await yarConnector.connect(relayer).onCrossCall(crossCallData, { value: crossCallData.value })

    assert((await chatAppMock.messagesLength(message.to)) > 0, 'message not received')
  })
})

async function signPermit(
  signer: SignerWithAddress,
  chainId: BigNumberish,
  yarConnector: string,
  signatureExpired: BigNumberish,
  crossCallData: YarConnector.CrossCallDataStruct,
): Promise<string> {
  const domain = {
    name: 'YarConnector',
    version: '1',
    chainId: chainId,
    verifyingContract: yarConnector,
  }
  const types = {
    Permit: [
      { name: 'nonce', type: 'uint256' },
      { name: 'signatureExpired', type: 'uint256' },
      { name: 'crossCallData', type: 'CrossCallData' },
    ],
    CrossCallData: [
      { name: 'initialChainId', type: 'uint256' },
      { name: 'sender', type: 'address' },
      { name: 'app', type: 'address' },
      { name: 'targetChainId', type: 'uint256' },
      { name: 'target', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'feeAmount', type: 'uint256' },
    ],
  }
  const permit = {
    nonce: 0,
    signatureExpired,
    crossCallData: crossCallData,
  }
  return await signer.signTypedData(domain, types, permit)
}
