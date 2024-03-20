import { deployments, ethers, network, upgrades } from 'hardhat'
import {
  AddressBook,
  AddressBook__factory,
  BridgeERC20,
  BridgeERC20__factory,
  IERC20Metadata,
  IERC20Metadata__factory,
  MultisigWallet,
  MultisigWallet__factory,
} from '../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { NATIVE_TOKEN, USDT } from '../constants/externalAddresses'
import ERC20MinterV2 from './utils/ERC20MinterV2'
import { BigNumber } from 'ethers'
import { impersonateAccount, setBalance } from '@nomicfoundation/hardhat-network-helpers'
import { SignatureUtils } from './utils/SignatureUtils'
import { expect } from 'chai'

describe('test_key_unit BridgeERC20', () => {
  let mockTransferApprover: SignerWithAddress
  let impersonatedOwner: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let bridge: BridgeERC20
  let addressBook: AddressBook
  let transferValidator: MultisigWallet
  let transferValidatorImpersonated: SignerWithAddress
  let initSnapshot: string

  before(async () => {
    const signers = await ethers.getSigners()
    mockTransferApprover = signers[8]
    user = signers[9]
    user2 = signers[8]
    await deployments.fixture()

    bridge = BridgeERC20__factory.connect(
      (await deployments.get('BridgeERC20')).address,
      ethers.provider,
    )

    addressBook = AddressBook__factory.connect(
      (await deployments.get('AddressBook')).address,
      ethers.provider,
    )

    transferValidator = MultisigWallet__factory.connect(
      (await deployments.get('TransferValidator')).address,
      ethers.provider,
    )

    const { owner } = await addressBook.admins()
    await impersonateAccount(owner)
    impersonatedOwner = await ethers.getSigner(owner)
    setBalance(owner, ethers.utils.parseEther('10'))

    await impersonateAccount(transferValidator.address)
    transferValidatorImpersonated = await ethers.getSigner(transferValidator.address)
    setBalance(transferValidatorImpersonated.address, ethers.utils.parseEther('10'))

    await addressBook.connect(impersonatedOwner).setTransferApprover(mockTransferApprover.address)

    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [initSnapshot])
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  it('Regular: trasnferToOtherChain erc20', async () => {
    const token = IERC20Metadata__factory.connect(USDT, ethers.provider)
    await ERC20MinterV2.mint(token.address, user.address, 1000)
    const userBalance = await token.balanceOf(user.address)
    console.log('aw10')
    await token.connect(user).approve(bridge.address, userBalance)

    console.log('aw11')
    const tragetChain = 199
    const recipient = user2
    const feeToken = await addressBook.feeToken()
    const fees = ethers.utils.parseEther('0.001')
    const signatureExpired = ethers.constants.MaxInt256
    const signature = await SignatureUtils.signMessage(
      mockTransferApprover,
      ethers.utils.solidityKeccak256(
        [
          'uint256',
          'address',
          'bytes4',
          'address',
          'address',
          'uint256',
          'uint256',
          'address',
          'address',
          'uint256',
          'uint256',
        ],
        [
          ethers.provider.network.chainId,
          bridge.address,
          bridge.interface.getSighash('tranferToOtherChain'),
          user.address,
          token.address,
          userBalance,
          tragetChain,
          recipient.address,
          feeToken,
          fees,
          signatureExpired,
        ],
      ),
    )
    console.log('aw1')
    const nonce = 1
    await expect(
      bridge
        .connect(user)
        .tranferToOtherChain(
          token.address,
          userBalance,
          tragetChain,
          recipient.address,
          feeToken,
          fees,
          signatureExpired,
          signature,
          {
            value: fees,
          },
        ),
    )
      .to.emit(bridge, 'TransferToOtherChain')
      .withArgs(
        await bridge.getTransferId(nonce, ethers.provider.network.chainId),
        nonce,
        ethers.provider.network.chainId,
        ethers.provider.network.chainId,
        token.address,
        tragetChain,
        userBalance,
        user.address,
        recipient.address,
        'Tether USD',
        'USDT',
        6,
      )
  })
})
