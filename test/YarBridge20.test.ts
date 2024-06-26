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

describe('YarBridge20', function () {
  let deployer: SignerWithAddress
  let oracle: SignerWithAddress
  let relayer: SignerWithAddress
  let user: SignerWithAddress
  let user2: SignerWithAddress
  let yarRequest: YarRequest
  let yarResponse: YarResponse
  let yarHub: YarHub
  let yarBridge20: YarBridge20
  let yarBridge20Mock: YarBridge20Mock
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

    yarBridge20 = YarBridge20__factory.connect(
      (await deployments.get('YarBridge20')).address,
      ethers.provider,
    )

    yarBridge20Mock = YarBridge20Mock__factory.connect(
      (await deployments.get('YarBridge20Mock')).address,
      ethers.provider,
    )
    chainId = (await ethers.provider.getNetwork()).chainId

    await yarBridge20.connect(deployer).setPeer(111, await yarBridge20Mock.getAddress(), 'YARMOCK')
    await yarBridge20Mock.connect(deployer).setPeer(chainId, await yarBridge20.getAddress(), 'YAR')

    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  afterEach(async () => {
    await ethers.provider.send('evm_revert', [initSnapshot])
    initSnapshot = await ethers.provider.send('evm_snapshot', [])
  })

  it('Example: native transfer', async () => {
    // ---------------------------

    const token = ethers.ZeroAddress // Отправляем чем бридж нативный токен
    const targetChainId = 111 // fake chain id
    const amount = ethers.parseEther('1') // сколько перевести
    const recipient = user2 // Получатель

    // ---------------------------

    // [0] STEP №0
    // Предварительно рассчитываем сколько комиссий взять за транзакции
    // В идеале если пользователи будут просто пополнять свой депозит, что бы не пришлось каждый раз это считать

    // Вызываем deployTo как view функцию посредством eth_call (в ethers это deployTo.staticCall)
    const estematedYarTxDeployTo = await yarBridge20
      .connect(user)
      .deployTo.staticCall(token, targetChainId)

    // Вызываем transferTo как view функцию посредством eth_call (в ethers это transferTo.staticCall)
    const estematedYarTxTrasferTo = await yarBridge20
      .connect(user)
      .transferTo.staticCall(token, amount, targetChainId, recipient.address, { value: amount })

    // [!] Получив модели YarTx из шага [0] мы их отправляем в сервис определяющий стоимость
    // Далее в тесте они не используются, здесь они изображены для примера как получить эти модели предварительно

    // ---------------------------

    // [1] STEP №1
    // Пользователь вносит депозит

    // сумма токенов в initial сети, которая будет сконвертирована в депозит в Yar
    const depositToYar = ethers.parseEther('1')

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
    // Что бы приложение могло указать пользователя в качестве плательщика комиссии
    // Пользователь должен разрешить приложению списывать баланс

    const approveAmount = ethers.MaxUint256 // сумма которую разрешаем списывать

    // Запрос на разрешение отправляется из intial сети в yarRequest
    const txApprove = yarRequest
      .connect(user)
      .approve(await yarBridge20.getAddress(), approveAmount)

    // Только для тестов
    // Проверяем получение ивента Approve
    await expect(txApprove)
      .to.emit(yarRequest, 'Approve')
      .withArgs(user.address, chainId, await yarBridge20.getAddress(), approveAmount)

    // После получения ивента Approve
    // Relayers вызывает транзакцию approve в yarHub
    const txApproveYarHub = yarHub
      .connect(relayer)
      .approve(user.address, chainId, await yarBridge20.getAddress(), approveAmount)

    // Только для тестов
    // Проверяем получение ивента Approve в yarHub
    await expect(txApproveYarHub)
      .to.emit(yarHub, 'Approve')
      .withArgs(user.address, chainId, await yarBridge20.getAddress(), approveAmount)

    // Только для тестов
    // Проверяем средства разрешены к списанию
    assert(
      (await yarHub.allowance(user.address, chainId, await yarBridge20.getAddress())) ==
        approveAmount,
      'approveAmount!',
    )

    // ---------------------------

    // [5] STEP №5
    // Перед тем как совершить перевод в другую сеть
    // В ней должен быть развернут yTOKEN
    // Для этого надо доставить транзакцию deployFrom в target сеть,
    // Посредством отправки транзакции deployTo из initial сети
    // * если токен уже был развернут в target сети, этот шаг можно пропустить

    // Только для тестов
    // Модель транзакции которую Relayers будут доставлять в YarHub и target сеть
    const yarTxDeployTo: YarLib.YarTXStruct = {
      initialChainId: chainId,
      sender: await yarBridge20.getAddress(),
      payer: user.address,
      targetChainId,
      target: await yarBridge20Mock.getAddress(),
      value: 0,
      data: yarBridge20.interface.encodeFunctionData('deployFrom', [
        chainId,
        token,
        await yarBridge20.nativeName(),
        await yarBridge20.nativeSymbol(),
        18,
      ]),
      _nonce: 0
    }

    // Юзер вызывает транзакцию, которая создаст запрос в YarRequest, поссле чего в target сети будет развернут bridged token
    const txDeployTo = yarBridge20.connect(user).deployTo(token, targetChainId)
    await expect(txDeployTo).to.emit(yarRequest, 'Send').withArgs(Object.values(yarTxDeployTo))

    // ---------------------------

    // [6] STEP №6
    // Relayers создает в yarHub ожидающую транакцию
    const txCreateTransactionDeploy = yarHub
      .connect(relayer)
      .createTransaction(yarTxDeployTo, (await txDeployTo).hash)

    // Только для тестов
    // Проверяем ивент CreateTransaction
    // Для сети Relayers он не важен и может не использоваться (или может, пожеланию)
    await expect(txCreateTransactionDeploy)
      .to.emit(yarHub, 'CreateTransaction')
      .withArgs(Object.values(yarTxDeployTo), await yarHub.getYarTxHash(yarTxDeployTo))

    // ---------------------------

    // [7] STEP №7
    // Relayers расчитывает сумму(в Yar) которую надо заблокировать на депозите пользователя
    const feeTokensToLockDeployTo = convertedDepositToYar / BigInt(2)

    // ---------------------------

    // [8] STEP №8
    // Relayers отправляет запрос в YarHub
    // Который если выполниться успешно, инициирует доставку в target сеть
    const txExecuteTransactionDeploy = yarHub
      .connect(relayer)
      .executeTransaction(yarTxDeployTo, feeTokensToLockDeployTo)

    // Только для тестов
    // Проверяем ивент ExecuteTransaction
    // Это тригер для сети Relayers, что бы доставить транзакцию в target сеть
    await expect(txExecuteTransactionDeploy)
      .to.emit(yarHub, 'ExecuteTransaction')
      .withArgs(Object.values(yarTxDeployTo), await yarHub.getYarTxHash(yarTxDeployTo))

    // ---------------------------

    // [9] STEP №9
    // Relayers получив ивент ExecuteTransaction из yarHub
    // Доставляет транзакцию в target сеть
    // Посредством вызова метода deliver в yarResponse
    const txDeliverDeploy = await yarResponse.connect(relayer).deliver(yarTxDeployTo)

    // Только для тестов
    // Проверяем что новый yTOKEN был развернут в target сети
    const bridgedToken = await yarBridge20Mock.getBridgedTokenAddress(chainId, token)
    assert(await yarBridge20Mock.isBridgedToken(bridgedToken), 'bridged token not created!')

    // ---------------------------

    // [10] STEP №10
    // После успешной доставки в target сети
    // Рассчитываем сколько в итоге было потрачено средсв на транзакцию и приводим их к Yar
    const usedFeesDeploy = feeTokensToLockDeployTo / BigInt(2)

    // ---------------------------

    // [11] STEP №11
    // Relayers обновляет статус транзакции, и возвращает сдачу на депозит
    const txCompleteTransactionDeploy = yarHub
      .connect(relayer)
      .completeTransaction(yarTxDeployTo, txDeliverDeploy.hash, usedFeesDeploy)

    // Только для тестов
    // Проверяем получение ивента CommitTransaction
    await expect(txCompleteTransactionDeploy)
      .to.emit(yarHub, 'CommitTransaction')
      .withArgs(
        Object.values(yarTxDeployTo),
        await yarHub.getYarTxHash(yarTxDeployTo),
        3, // completed status
        usedFeesDeploy,
        feeTokensToLockDeployTo - usedFeesDeploy,
      )

    // ---------------------------

    // [12] STEP №12
    // Пользователь делает кроссчейн перевод токенов через мост

    // Только для тестов
    // Модель транзакции которую Relayers будут доставлять в YarHub и target сеть
    const yarTxTransferTo: YarLib.YarTXStruct = {
      initialChainId: chainId,
      sender: await yarBridge20.getAddress(),
      payer: user.address,
      targetChainId,
      target: await yarBridge20Mock.getAddress(),
      value: 0,
      data: yarBridge20.interface.encodeFunctionData('transferFrom', [
        chainId,
        token,
        amount,
        recipient.address,
      ]),
      _nonce: 1
    }

    // Отправка юзером токенов в мост
    // Токены остаются на балансе yarBridge20
    const txTransferTo = yarBridge20
      .connect(user)
      .transferTo(token, amount, targetChainId, recipient.address, { value: amount })

    // Только для тестов
    // Проверяем что был получен ивент Send
    await expect(txTransferTo).to.emit(yarRequest, 'Send').withArgs(Object.values(yarTxTransferTo))

    // ---------------------------

    // [13] STEP №13
    // Relayers создает в yarHub ожидающую транакцию
    const txCreateTransactionTrasfer = yarHub
      .connect(relayer)
      .createTransaction(yarTxTransferTo, (await txTransferTo).hash)

    // Только для тестов
    // Проверяем ивент CreateTransaction
    // Для сети Relayers он не важен и может не использоваться (или может, пожеланию)
    await expect(txCreateTransactionTrasfer)
      .to.emit(yarHub, 'CreateTransaction')
      .withArgs(Object.values(yarTxTransferTo), await yarHub.getYarTxHash(yarTxTransferTo))

    // ---------------------------

    // [14] STEP №14
    // Relayers расчитывает сумму(в Yar) которую надо заблокировать на депозите пользователя
    const feeTokensToLockTransferTo = convertedDepositToYar / BigInt(2)

    // ---------------------------

    // [15] STEP №15
    // Relayers отправляет запрос в YarHub
    // Который если выполниться успешно, инициирует доставку в target сеть
    const txExecuteTransactionTransfer = yarHub
      .connect(relayer)
      .executeTransaction(yarTxTransferTo, feeTokensToLockDeployTo)

    // Только для тестов
    // Проверяем ивент ExecuteTransaction
    // Это тригер для сети Relayers, что бы доставить транзакцию в target сеть
    await expect(txExecuteTransactionTransfer)
      .to.emit(yarHub, 'ExecuteTransaction')
      .withArgs(Object.values(yarTxTransferTo), await yarHub.getYarTxHash(yarTxTransferTo))

    // ---------------------------

    // [16] STEP №16
    // Relayers доставляет транзакцию в target сеть
    const txDeliverTransfer = await yarResponse.connect(relayer).deliver(yarTxTransferTo)

    // Только для тестов
    // Проверяем что получатель получил yTOKEN в количестве amount
    assert(
      (await IERC20Metadata__factory.connect(bridgedToken, ethers.provider).balanceOf(
        recipient.address,
      )) == amount,
      'recipient not recived yTOKENS',
    )

    // ---------------------------

    // [17] STEP №17
    // После успешной доставки в target сети
    // Рассчитываем сколько в итоге было потрачено средсв на транзакцию и приводим их к Yar
    const usedFeesTransfer = feeTokensToLockTransferTo / BigInt(2)

    // ---------------------------

    // [18] STEP №18
    // Relayers обновляет статус транзакции, и возвращает сдачу на депозит
    const txCompleteTransactionTransfer = yarHub
      .connect(relayer)
      .completeTransaction(yarTxTransferTo, txDeliverTransfer.hash, usedFeesTransfer)

    // Только для тестов
    // Проверяем получение ивента CommitTransaction
    await expect(txCompleteTransactionTransfer)
      .to.emit(yarHub, 'CommitTransaction')
      .withArgs(
        Object.values(yarTxTransferTo),
        await yarHub.getYarTxHash(yarTxTransferTo),
        3, // completed status
        usedFeesTransfer,
        feeTokensToLockTransferTo - usedFeesTransfer,
      )
    // ---------------------------
  })

  it('Example: eip20 transfer', async () => {
    // ---------------------------

    const token = IERC20Metadata__factory.connect(USDT, ethers.provider)
    const targetChainId = 111 // fake chain id
    const amount = ethers.parseUnits('1', 6) // сколько перевести
    const recipient = user2 // Получатель

    // ---------------------------

    // [0] STEP №0
    // Предварительно рассчитываем сколько комиссий взять за транзакции
    // В идеале если пользователи будут просто пополнять свой депозит, что бы не пришлось каждый раз это считать

    // Вызываем deployTo как view функцию посредством eth_call (в ethers это deployTo.staticCall)
    const estematedYarTxDeployTo = await yarBridge20
      .connect(user)
      .deployTo.staticCall(token, targetChainId)

    // Вызываем transferTo как view функцию посредством eth_call (в ethers это transferTo.staticCall)
    // Но предварительно, что бы мы могли сэмулировать транзакцию, пользователь должен разрешить переводить токены
    // Иначе эмуляция завершится ошибкой, так как не сможет перевести токены с баланса пользователя
    await ERC20Minter.mint(await token.getAddress(), user.address, 1000000)
    await token.connect(user).approve(await yarBridge20.getAddress(), amount)
    const estematedYarTxTrasferTo = await yarBridge20
      .connect(user)
      .transferTo.staticCall(token, amount, targetChainId, recipient.address)

    // [!] Получив модели YarTx из шага [0] мы их отправляем в сервис определяющий стоимость
    // Далее в тесте они не используются, здесь они изображены для примера как получить эти модели предварительно

    // ---------------------------

    // [1] STEP №1
    // Пользователь вносит депозит

    // сумма токенов в initial сети, которая будет сконвертирована в депозит в Yar
    const depositToYar = ethers.parseEther('1')

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
    // Что бы приложение могло указать пользователя в качестве плательщика комиссии
    // Пользователь должен разрешить приложению списывать баланс

    const approveAmount = ethers.MaxUint256 // сумма которую разрешаем списывать

    // Запрос на разрешение отправляется из intial сети в yarRequest
    const txApprove = yarRequest
      .connect(user)
      .approve(await yarBridge20.getAddress(), approveAmount)

    // Только для тестов
    // Проверяем получение ивента Approve
    await expect(txApprove)
      .to.emit(yarRequest, 'Approve')
      .withArgs(user.address, chainId, await yarBridge20.getAddress(), approveAmount)

    // После получения ивента Approve
    // Relayers вызывает транзакцию approve в yarHub
    const txApproveYarHub = yarHub
      .connect(relayer)
      .approve(user.address, chainId, await yarBridge20.getAddress(), approveAmount)

    // Только для тестов
    // Проверяем получение ивента Approve в yarHub
    await expect(txApproveYarHub)
      .to.emit(yarHub, 'Approve')
      .withArgs(user.address, chainId, await yarBridge20.getAddress(), approveAmount)

    // Только для тестов
    // Проверяем средства разрешены к списанию
    assert(
      (await yarHub.allowance(user.address, chainId, await yarBridge20.getAddress())) ==
        approveAmount,
      'approveAmount!',
    )

    // ---------------------------

    // [5] STEP №5
    // Перед тем как совершить перевод в другую сеть
    // В ней должен быть развернут yTOKEN
    // Для этого надо доставить транзакцию deployFrom в target сеть,
    // Посредством отправки транзакции deployTo из initial сети
    // * если токен уже был развернут в target сети, этот шаг можно пропустить

    // Только для тестов
    // Модель транзакции которую Relayers будут доставлять в YarHub и target сеть
    const yarTxDeployTo: YarLib.YarTXStruct = {
      initialChainId: chainId,
      sender: await yarBridge20.getAddress(),
      payer: user.address,
      targetChainId,
      target: await yarBridge20Mock.getAddress(),
      value: 0,
      data: yarBridge20.interface.encodeFunctionData('deployFrom', [
        chainId,
        await token.getAddress(),
        'Tether USD',
        'USDT',
        6,
      ]),
      _nonce: 0
    }

    // Юзер вызывает транзакцию, которая создаст запрос в YarRequest, поссле чего в target сети будет развернут bridged token
    const txDeployTo = yarBridge20.connect(user).deployTo(await token.getAddress(), targetChainId)
    await expect(txDeployTo).to.emit(yarRequest, 'Send').withArgs(Object.values(yarTxDeployTo))

    // ---------------------------

    // [6] STEP №6
    // Relayers создает в yarHub ожидающую транакцию
    const txCreateTransactionDeploy = yarHub
      .connect(relayer)
      .createTransaction(yarTxDeployTo, (await txDeployTo).hash)

    // Только для тестов
    // Проверяем ивент CreateTransaction
    // Для сети Relayers он не важен и может не использоваться (или может, пожеланию)
    await expect(txCreateTransactionDeploy)
      .to.emit(yarHub, 'CreateTransaction')
      .withArgs(Object.values(yarTxDeployTo), await yarHub.getYarTxHash(yarTxDeployTo))

    // ---------------------------

    // [7] STEP №7
    // Relayers расчитывает сумму(в Yar) которую надо заблокировать на депозите пользователя
    const feeTokensToLockDeployTo = convertedDepositToYar / BigInt(2)

    // ---------------------------

    // [8] STEP №8
    // Relayers отправляет запрос в YarHub
    // Который если выполниться успешно, инициирует доставку в target сеть
    const txExecuteTransactionDeploy = yarHub
      .connect(relayer)
      .executeTransaction(yarTxDeployTo, feeTokensToLockDeployTo)

    // Только для тестов
    // Проверяем ивент ExecuteTransaction
    // Это тригер для сети Relayers, что бы доставить транзакцию в target сеть
    await expect(txExecuteTransactionDeploy)
      .to.emit(yarHub, 'ExecuteTransaction')
      .withArgs(Object.values(yarTxDeployTo), await yarHub.getYarTxHash(yarTxDeployTo))

    // ---------------------------

    // [9] STEP №9
    // Relayers получив ивент ExecuteTransaction из yarHub
    // Доставляет транзакцию в target сеть
    // Посредством вызова метода deliver в yarResponse
    const txDeliverDeploy = await yarResponse.connect(relayer).deliver(yarTxDeployTo)

    // Только для тестов
    // Проверяем что новый yTOKEN был развернут в target сети
    const bridgedToken = await yarBridge20Mock.getBridgedTokenAddress(
      chainId,
      await token.getAddress(),
    )
    assert(await yarBridge20Mock.isBridgedToken(bridgedToken), 'bridged token not created!')
    assert(
      (await IERC20Metadata__factory.connect(bridgedToken, ethers.provider).symbol()) == "USDT:YAR",
      'bridged token invalid symbol',
    )

    // ---------------------------

    // [10] STEP №10
    // После успешной доставки в target сети
    // Рассчитываем сколько в итоге было потрачено средсв на транзакцию и приводим их к Yar
    const usedFeesDeploy = feeTokensToLockDeployTo / BigInt(2)

    // ---------------------------

    // [11] STEP №11
    // Relayers обновляет статус транзакции, и возвращает сдачу на депозит
    const txCompleteTransactionDeploy = yarHub
      .connect(relayer)
      .completeTransaction(yarTxDeployTo, txDeliverDeploy.hash, usedFeesDeploy)

    // Только для тестов
    // Проверяем получение ивента CommitTransaction
    await expect(txCompleteTransactionDeploy)
      .to.emit(yarHub, 'CommitTransaction')
      .withArgs(
        Object.values(yarTxDeployTo),
        await yarHub.getYarTxHash(yarTxDeployTo),
        3, // completed status
        usedFeesDeploy,
        feeTokensToLockDeployTo - usedFeesDeploy,
      )

    // ---------------------------

    // [12] STEP №12
    // Пользователь делает кроссчейн перевод токенов через мост

    // Только для тестов
    // Модель транзакции которую Relayers будут доставлять в YarHub и target сеть
    const yarTxTransferTo: YarLib.YarTXStruct = {
      initialChainId: chainId,
      sender: await yarBridge20.getAddress(),
      payer: user.address,
      targetChainId,
      target: await yarBridge20Mock.getAddress(),
      value: 0,
      data: yarBridge20.interface.encodeFunctionData('transferFrom', [
        chainId,
        await token.getAddress(),
        amount,
        recipient.address,
      ]),
      _nonce: 1
    }

    // Отправка юзером токенов в мост
    // Токены остаются на балансе yarBridge20
    const txTransferTo = yarBridge20
      .connect(user)
      .transferTo(await token.getAddress(), amount, targetChainId, recipient.address)

    // Только для тестов
    // Проверяем что был получен ивент Send
    await expect(txTransferTo).to.emit(yarRequest, 'Send').withArgs(Object.values(yarTxTransferTo))

    // ---------------------------

    // [13] STEP №13
    // Relayers создает в yarHub ожидающую транакцию
    const txCreateTransactionTrasfer = yarHub
      .connect(relayer)
      .createTransaction(yarTxTransferTo, (await txTransferTo).hash)

    // Только для тестов
    // Проверяем ивент CreateTransaction
    // Для сети Relayers он не важен и может не использоваться (или может, пожеланию)
    await expect(txCreateTransactionTrasfer)
      .to.emit(yarHub, 'CreateTransaction')
      .withArgs(Object.values(yarTxTransferTo), await yarHub.getYarTxHash(yarTxTransferTo))

    // ---------------------------

    // [14] STEP №14
    // Relayers расчитывает сумму(в Yar) которую надо заблокировать на депозите пользователя
    const feeTokensToLockTransferTo = convertedDepositToYar / BigInt(2)

    // ---------------------------

    // [15] STEP №15
    // Relayers отправляет запрос в YarHub
    // Который если выполниться успешно, инициирует доставку в target сеть
    const txExecuteTransactionTransfer = yarHub
      .connect(relayer)
      .executeTransaction(yarTxTransferTo, feeTokensToLockTransferTo)

    // Только для тестов
    // Проверяем ивент ExecuteTransaction
    // Это тригер для сети Relayers, что бы доставить транзакцию в target сеть
    await expect(txExecuteTransactionTransfer)
      .to.emit(yarHub, 'ExecuteTransaction')
      .withArgs(Object.values(yarTxTransferTo), await yarHub.getYarTxHash(yarTxTransferTo))

    // ---------------------------

    // [16] STEP №16
    // Relayers доставляет транзакцию в target сеть
    const txDeliverTransfer = await yarResponse.connect(relayer).deliver(yarTxTransferTo)

    // Только для тестов
    // Проверяем что получатель получил yTOKEN в количестве amount
    assert(
      (await IERC20Metadata__factory.connect(bridgedToken, ethers.provider).balanceOf(
        recipient.address,
      )) == amount,
      'recipient not recived yTOKENS',
    )

    // ---------------------------

    // [17] STEP №17
    // После успешной доставки в target сети
    // Рассчитываем сколько в итоге было потрачено средсв на транзакцию и приводим их к Yar
    const usedFeesTransfer = feeTokensToLockTransferTo / BigInt(2)

    // ---------------------------

    // [18] STEP №18
    // Relayers обновляет статус транзакции, и возвращает сдачу на депозит
    const txCompleteTransactionTransfer = yarHub
      .connect(relayer)
      .completeTransaction(yarTxTransferTo, txDeliverTransfer.hash, usedFeesTransfer)

    // Только для тестов
    // Проверяем получение ивента CommitTransaction
    await expect(txCompleteTransactionTransfer)
      .to.emit(yarHub, 'CommitTransaction')
      .withArgs(
        Object.values(yarTxTransferTo),
        await yarHub.getYarTxHash(yarTxTransferTo),
        3, // completed status
        usedFeesTransfer,
        feeTokensToLockTransferTo - usedFeesTransfer,
      )
    // ---------------------------
  })
})
