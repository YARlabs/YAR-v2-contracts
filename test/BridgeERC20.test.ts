import { deployments, ethers, upgrades } from 'hardhat'
import {
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

describe('test_key_unit BridgeERC20', () => {
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let bridge: BridgeERC20
  let transferValidator: MultisigWallet
  let transferValidatorImpersonated: SignerWithAddress
  let initSnapshot: string

  before(async () => {
    const signers = await ethers.getSigners()
    user = signers[9]
    user2 = signers[8]
    deployments.fixture()

    bridge = BridgeERC20__factory.connect(
      (await deployments.get('BridgeERC20')).address,
      ethers.provider,
    )

    transferValidator = MultisigWallet__factory.connect(
      (await deployments.get('TransferValidator')).address,
      ethers.provider,
    )

    await impersonateAccount(transferValidator.address)
    transferValidatorImpersonated = await ethers.getSigner(transferValidator.address)
    setBalance(transferValidatorImpersonated.address, ethers.utils.parseEther('10'))

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
    await token.connect(user).approve(bridge.address, userBalance)

    const tragetChain = 199
    const recipient = user2
    const feeToken = user2
    bridge.connect(user).tranferToOtherChain(token.address, userBalance, tragetChain, recipient.address, )
  })
})
