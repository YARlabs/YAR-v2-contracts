import { assert, expect, use } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import {
  IERC20Metadata__factory,
  YarBridge20,
  YarBridge20Mock,
  YarBridge20Mock__factory,
  YarBridge20__factory,
  YarHub,
  YarHub__factory,
  YarRequest,
  YarRequest__factory,
  YarResponse,
  YarResponse__factory,
} from '../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { BigNumberish } from 'ethers'
import { YarLib } from '../typechain-types/contracts/YarRequest'
import { USDT } from '../constants/externalAddresses'
import ERC20Minter from './utils/ERC20Minter'

describe('GasBridge', function () {
  let deployer: SignerWithAddress
  let oracle: SignerWithAddress
  let relayer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let yarRequest: YarRequest
  let yarResponse: YarResponse
  let yarHub: YarHub
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
    yarHub = YarHub__factory.connect((await deployments.get('YarHub')).address, ethers.provider)

    chainId = (await ethers.provider.getNetwork()).chainId

    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [initSnapshot])
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  it('Example', async () => { 
    // ---------------------------

    const targetChainId = 111 // сеть доставки
    const recipient = user2 // получатель
    const amount = ethers.parseEther('1') // сумма нативных токенов которую получит recipeint

    const yarTxSend: YarLib.YarTXStruct = {
      initialChainId: chainId, // сеть отпарвки
      sender: user.address, // Пользователь инициирубщий перевод
      payer: user.address, // Пользователь который платит комиссию (и за value)
      targetChainId, // сеть доставки
      target: recipient.address, // кто получит
      value: amount, // сколько нативных токенов доставить
      data: '0x', // пустая, потому что мы не вызываем смарт контракт, а сразу переводим на адрес
    }

    // ---------------------------

    // [0] STEP №0
    // Предварительно рассчитываем сколько комиссий взять за транзакции
    // В идеале если пользователи будут просто пополнять свой депозит, что бы не пришлось каждый раз это считать

    // Вызываем deployTo как view функцию посредством eth_call
    const estematedYarTxSend = await yarRequest.connect(user).send.staticCall(yarTxSend)
      
    // [!] Получив модели YarTx из шага [0] мы их отправляем в сервис определяющий стоимость
    // Далее в тесте они не используются, здесь они изображены для примера как получить эти модели предварительно

    // ---------------------------

    // [1] STEP №1
    // Пользователь вносит депозит

    // сумма токенов в initial сети, которая будет сконвертирована в депозит в Yar
    const depositToYar = ethers.parseEther('1')

    ethers.provider.getLogs

    // Юзер вносит депозит
    const txDeposit = yarRequest.connect(user).deposit(depositToYar, { value: depositToYar })

    // Только для тестов
    // Проверяем получение ивента Deposit
    await expect(txDeposit)
      .to.emit(yarRequest, 'Deposit')
      .withArgs(user.address, ethers.ZeroAddress, depositToYar)

    // ---------------------------

    // [2] STEP №2
    // Relayers получив ивент Deposit из контракта yarRequest
    // Конвертирует feeToken amount к количеству токенов Yar
    const convertedDepositToYar = depositToYar * BigInt(2) // fake convert

    // ---------------------------

    // [3] STEP №3
    // Relayers отправляет транзакцию deposit в YarHub
    // Тем самым зачисляя расчетное(из шага 2) количество токенов на депозит юзера

    // Relayers зачисляет депозит юзеру
    const txDepositYarHub = yarHub.connect(relayer).deposit(user.address, convertedDepositToYar)

    // Только для тестов
    // Проверяем получение ивента Deposit в YarHub
    await expect(txDepositYarHub)
      .to.emit(yarHub, 'Deposit')
      .withArgs(user.address, convertedDepositToYar)

    // ---------------------------

    // [4] STEP №4
    // Юзер отправляет запрос, на выполнение кросс-чейн транзакции которая доставит нативный токен в другой сети
    const txSend = yarRequest.connect(user).send(yarTxSend)

    // Только для тестов
    // Проверяем что был получен ивент Send
    await expect(txSend).to.emit(yarRequest, 'Send').withArgs(Object.values(yarTxSend))

    // ---------------------------

    // [5] STEP №5
    // Relayers создает в yarHub ожидающую транакцию
    const txCreateTransactionTrasfer = yarHub
      .connect(relayer)
      .createTransaction(yarTxSend, (await txSend).hash)

    // Только для тестов
    // Проверяем ивент CreateTransaction
    // Для сети Relayers он не важен и может не использоваться (или может, пожеланию)
    await expect(txCreateTransactionTrasfer)
      .to.emit(yarHub, 'CreateTransaction')
      .withArgs(Object.values(yarTxSend))

    // ---------------------------

    // [6] STEP №6
    // Relayers расчитывает сумму(в Yar) которую надо заблокировать на депозите пользователя
    const feeTokensToLock = convertedDepositToYar / BigInt(2)

    // ---------------------------

    // [7] STEP №7
    // Relayers отправляет запрос в YarHub
    // Который если выполниться успешно, инициирует доставку в target сеть
    const txExecuteTransactionTransfer = yarHub
      .connect(relayer)
      .executeTransaction(yarTxSend, feeTokensToLock)

    // Только для тестов
    // Проверяем ивент ExecuteTransaction
    // Это тригер для сети Relayers, что бы доставить транзакцию в target сеть
    await expect(txExecuteTransactionTransfer)
      .to.emit(yarHub, 'ExecuteTransaction')
      .withArgs(Object.values(yarTxSend))

    // ---------------------------

    // [8] STEP №8
    // Relayers доставляет транзакцию в target сеть

    const recipientBalanceBefore = await ethers.provider.getBalance(recipient.address)

    const txDeliver = await yarResponse
      .connect(relayer)
      .deliver(yarTxSend, { value: yarTxSend.value })

    const recipientBalanceAfter = await ethers.provider.getBalance(recipient.address)

    assert(
      recipientBalanceAfter == recipientBalanceBefore + amount,
      'recipeint not recieved gas tokens!',
    )

    // [9] STEP №9
    // После успешной доставки в target сети
    // Рассчитываем сколько в итоге было потрачено средсв на транзакцию и приводим их к Yar
    const usedFees = feeTokensToLock / BigInt(2)

    // ---------------------------

    // [10] STEP №10
    // Relayers обновляет статус транзакции, и возвращает сдачу на депозит
    const txCompleteTransactionTransfer = yarHub
      .connect(relayer)
      .completeTransaction(yarTxSend, txDeliver.hash, usedFees)

    // Только для тестов
    // Проверяем получение ивента CommitTransaction
    await expect(txCompleteTransactionTransfer)
      .to.emit(yarHub, 'CommitTransaction')
      .withArgs(
        Object.values(yarTxSend),
        3, // completed status
        usedFees,
        feeTokensToLock - usedFees,
      )
    // ---------------------------
  })
})
