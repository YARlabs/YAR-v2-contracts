import { time, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs'
import { assert, expect } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import {
  YarConnector,
  YarConnector__factory,
} from '../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { BigNumberish } from 'ethers'

describe('YarConnector', function () {
  let deployer: SignerWithAddress
  let oracle: SignerWithAddress
  let relayer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let yarConnector: YarConnector
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
    chainId = (await ethers.provider.getNetwork()).chainId
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [initSnapshot])
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })
  
  describe('onCrossCall', () => {
    it('onCrossCall value[_] data[_]', async () => {
      const initialChainId = 111
      const sender = user.address
      const app = user2.address
      const targetChainId = chainId
      const target = user.address
      const value = 0n
      const feeAmount = 0n
      const data = '0x'

      const targetBalanceBefore = await ethers.provider.getBalance(user.address)

      await yarConnector
        .connect(relayer)
        .onCrossCall(
          { initialChainId, sender, app, targetChainId, target, value, data, feeAmount },
          { value: value },
        )

      const targetBalanceAfter = await ethers.provider.getBalance(user.address)

      assert(targetBalanceAfter == targetBalanceBefore, 'targetBalanceBefore changed!')
    })

    it('onCrossCall value[_] data[+]', async () => {
      const initialChainId = 111
      const sender = user.address
      const app = user2.address
      const targetChainId = chainId
      const target = user.address
      const value = 0n
      const feeAmount = 0n
      const data = ethers.solidityPackedKeccak256(['string'], ['Hello'])

      const targetBalanceBefore = await ethers.provider.getBalance(user.address)

      const tx = await yarConnector
        .connect(relayer)
        .onCrossCall(
          { initialChainId, sender, app, targetChainId, target, value, data, feeAmount },
          { value: value },
        )

      const targetBalanceAfter = await ethers.provider.getBalance(user.address)

      assert(targetBalanceAfter == targetBalanceBefore, 'targetBalanceBefore changed!')
    })

    it('onCrossCall: value[+] data[+]', async () => {
      const initialChainId = 111
      const sender = user.address
      const app = user2.address
      const targetChainId = chainId
      const target = user.address
      const value = ethers.parseEther('1')
      const feeAmount = 0n
      const data = ethers.solidityPackedKeccak256(['string'], ['Hello'])

      const targetBalanceBefore = await ethers.provider.getBalance(user.address)

      const tx = await yarConnector
        .connect(relayer)
        .onCrossCall(
          { initialChainId, sender, app, targetChainId, target, value, data, feeAmount },
          { value: value },
        )

      const targetBalanceAfter = await ethers.provider.getBalance(user.address)

      assert(targetBalanceAfter == targetBalanceBefore + value, 'target not revceived value!')
    })

    it('onCrossCall: value[+] data[_]', async () => {
      const initialChainId = 111
      const sender = user.address
      const app = user2.address
      const targetChainId = chainId
      const target = user2
      const value = 10n
      const data = '0x'
      const feeAmount = 0n

      const targetBalanceBefore = await ethers.provider.getBalance(target.address)

      await yarConnector
        .connect(relayer)
        .onCrossCall(
          { initialChainId, sender, app, targetChainId, target, value, data, feeAmount },
          { value: value },
        )

      const targetBalanceAfter = await ethers.provider.getBalance(target.address)

      assert(targetBalanceAfter == targetBalanceBefore + value, 'target not recived native tokens!')
    })
  })

  describe('crossCall', async () => {
    it('crossCall: fees[_] value[_]', async () => {
      const initialChainId = chainId
      const sender = user.address
      const app = user.address
      const targetChainId = 111
      const target = user2
      const value = 0
      const data = '0x'
      const feeAmount = 0

      await expect(
        yarConnector.connect(user).crossCall({
          initialChainId,
          sender,
          app,
          targetChainId,
          target,
          value,
          data,
          feeAmount,
        }),
      )
        .to.emit(yarConnector, 'CrossCall')
        .withArgs([initialChainId, sender, app, targetChainId, target, value, data, feeAmount])
        .to.not.emit(yarConnector, 'SendFees')
    })

    it('crossCall: fees[_] value[+]', async () => {
      const initialChainId = chainId
      const sender = user.address
      const app = user.address
      const targetChainId = 111
      const target = user2
      const value = ethers.parseEther('1')
      const data = '0x'
      const feeAmount = 0

      await expect(
        yarConnector.connect(user).crossCall(
          {
            initialChainId,
            sender,
            app,
            targetChainId,
            target,
            value,
            data,
            feeAmount,
          },
          {
            value,
          },
        ),
      )
        .to.emit(yarConnector, 'CrossCall')
        .withArgs([initialChainId, sender, app, targetChainId, target, value, data, feeAmount])
        .to.not.emit(yarConnector, 'SendFees')

      const connectorBalanceAfter = await ethers.provider.getBalance(
        await yarConnector.getAddress(),
      )
    })

    it('crossCall: fees[+] value[_]', async () => {
      const initialChainId = chainId
      const sender = user.address
      const app = user.address
      const targetChainId = 111
      const target = user2
      const value = 0
      const data = '0x'
      const feeAmount = 1n

      await expect(
        yarConnector.connect(user).crossCall({
          initialChainId,
          sender,
          app,
          targetChainId,
          target,
          value,
          data,
          feeAmount,
        }),
      ).to.be.revertedWith('feeAmount!')

      await expect(
        yarConnector
          .connect(user)
          .crossCall(
            { initialChainId, sender, app, targetChainId, target, value, data, feeAmount },
            { value: feeAmount + 1n },
          ),
      ).to.be.revertedWith('feeAmount!')

      const connectorBalanceBefore = await ethers.provider.getBalance(
        await yarConnector.getAddress(),
      )

      await expect(
        yarConnector
          .connect(user)
          .crossCall(
            { initialChainId, sender, app, targetChainId, target, value, data, feeAmount },
            { value: feeAmount },
          ),
      )
        .to.emit(yarConnector, 'CrossCall')
        .withArgs([initialChainId, sender, app, targetChainId, target, value, data, feeAmount])
        .to.emit(yarConnector, 'SendFees')
        .withArgs(user.address, await yarConnector.feeToken(), feeAmount)

      const connectorBalanceAfter = await ethers.provider.getBalance(
        await yarConnector.getAddress(),
      )

      assert(
        connectorBalanceAfter == connectorBalanceBefore + feeAmount,
        'connector not recived fees!',
      )
    })

    it('crossCall: fees[+] value[+]', async () => {
      const initialChainId = chainId
      const sender = user.address
      const app = user.address
      const targetChainId = 111
      const target = user2
      const value = ethers.parseEther('1')
      const data = '0x'
      const feeAmount = 1n

      const connectorBalanceBefore = await ethers.provider.getBalance(
        await yarConnector.getAddress(),
      )

      await expect(
        yarConnector
          .connect(user)
          .crossCall(
            { initialChainId, sender, app, targetChainId, target, value, data, feeAmount },
            { value: feeAmount },
          ),
      )
        .to.emit(yarConnector, 'CrossCall')
        .withArgs([initialChainId, sender, app, targetChainId, target, value, data, feeAmount])
        .to.emit(yarConnector, 'SendFees')
        .withArgs(user.address, await yarConnector.feeToken(), feeAmount)

      const connectorBalanceAfter = await ethers.provider.getBalance(
        await yarConnector.getAddress(),
      )

      assert(
        connectorBalanceAfter == connectorBalanceBefore + feeAmount,
        `connector not recived fees! ${connectorBalanceAfter} != ${connectorBalanceBefore} + ${feeAmount}`,
      )
    })
  })
})
